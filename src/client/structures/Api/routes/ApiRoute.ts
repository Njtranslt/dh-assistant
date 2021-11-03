import type { modlog } from ".prisma/client";
import type { Logger } from "@daangamesdg/logger";
import Collection from "@discordjs/collection";
import { NextFunction, Request, Response, Router } from "express";
import type Client from "../../../Client";
import type { ApiResponse, LeaderboardStat, User } from "../../../types";
import Utils from "../utils";

export class ApiRoute {
	public router: Router;
	public utils: Utils;

	public constructor(public client: Client, public logger: Logger) {
		this.utils = new Utils(client);
		this.router = Router();
		this.router.get("/user", this.user.bind(this)); // get user

		this.router
			.get("/modlogs", this.modCheck.bind(this), this.modlogs.bind(this)) // get all modlogs
			.get("/modlogs/:userId", this.modCheck.bind(this), this.modlog.bind(this)); // get all modlogs of a user

		this.router.get("/leaderboard", this.leaderboard.bind(this)); // get leaderboard
	}

	private async modCheck(req: Request, res: Response, next: NextFunction) {
		if (!req.auth) {
			res.send(null);
			return;
		}

		try {
			const guild = this.client.guilds.cache.get(this.client.constants.guild);
			if (!guild) throw new Error("Unable to get the correct guild");

			const member = await this.client.utils.fetchMember(req.auth.userId, guild);
			if (!member || (!this.client.permissionHandler.hasMod(member) && !this.client.isOwner(member.id))) {
				res.send(null);
				return;
			}

			next();
		} catch (err) {
			res.status(500).json({ message: "internal server error", error: err.message });
		}
	}

	// private async adminCheck(req: Request, res: Response, next: NextFunction) {
	// 	if (!req.auth) return res.send(null);

	// 	try {
	// 		const guild = this.client.guilds.cache.get(this.client.constants.guild);
	// 		if (!guild) throw new Error("Unable to get the correct guild");

	// 		const member = await this.client.utils.fetchMember(req.auth.userId, guild);
	// 		if (!member || (!this.client.permissionHandler.hasSenior(member) && !this.client.isOwner(member.id))) return res.send(null);

	// 		next();
	// 	} catch (err) {
	// 		res.status(500).json({ message: "internal server error", error: err.message });
	// 	}
	// }

	private async user(req: Request, res: Response<User | ApiResponse>) {
		if (!req.auth) {
			res.send(null);
			return;
		}

		try {
			const user: User = this.client.ApiCache.get(`${req.auth.userId}-user`) || (await this.utils.getUser(req.auth.userId));
			if (!user) throw new Error("unable to get user");

			const guild = this.client.guilds.cache.get(this.client.constants.guild);
			if (!guild) {
				res.send(user);
				return;
			}

			const member = await this.client.utils.fetchMember(req.auth.userId, guild);
			if (!member) {
				res.send(user);
				return;
			}

			res.send({ ...user, rank: this.client.permissionHandler.getRank(member) });
		} catch (err) {
			res.status(500).json({ message: "internal server error", error: err.message });
		}
	}

	private async leaderboard(req: Request, res: Response) {
		try {
			let stats: LeaderboardStat[] = this.client.ApiCache.get("leaderboard");
			if (!stats) {
				stats = await this.client.levelManager.getLevels(this.client.constants.guild);
				this.utils.setCache("leaderboard", stats);
			}

			res.send(stats);
		} catch (err) {
			res.status(500).json({ message: "internal server error", error: err.message });
		}
	}

	private async modlogs(req: Request, res: Response) {
		try {
			let logs: modlog[] = this.client.ApiCache.get("modlog");
			if (!logs) {
				logs = await this.client.prisma.modlog.findMany({
					where: { id: { endsWith: this.client.constants.guild } }
				});
				this.utils.setCache("modlog", logs);
			}

			const tempCache = new Collection<string, number>();
			logs.forEach((w) => tempCache.set(w.id, (tempCache.get(w.id) ?? 0) + 1));

			const _logs = tempCache.sort((a, b) => b - a).map((amount, id) => ({ id, amount }));
			const parsed = await Promise.all(
				_logs.map(async ({ id, amount }) => {
					const user = await this.utils.getUser(id);
					if (user && "error" in user) throw new Error(user.error);
					return { user, amount };
				})
			);

			res.send(parsed);
		} catch (err) {
			res.status(500).json({ message: "internal server error", error: err.message });
		}
	}

	private async modlog(req: Request, res: Response) {
		const { userId } = req.params;
		if (!userId) {
			res.status(400).send("Bad request");
			return;
		}

		try {
			let logs: modlog[] = this.client.ApiCache.get(`${userId}-modlog`);
			if (!logs) {
				logs = await this.client.prisma.modlog.findMany({
					where: { id: `${userId}-${this.client.constants.guild}` }
				});
				this.utils.setCache(`${userId}-modlog`, logs);
			}

			const user = await this.utils.getUser(userId);
			if (user && "error" in user) throw new Error(user.error);

			res.send({ user, logs });
		} catch (err) {
			res.status(500).json({ message: "internal server error", error: err.message });
		}
	}
}