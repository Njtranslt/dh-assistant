import { MessageAttachment, User, GuildMember } from "discord.js";
import dhClient from "../client/client";
import { iLevel } from "../model/interfaces";
import Level from "../model/levels/Level";
import { Rank } from "canvacord";

export default class LevelManager {
	public boost: number = 1;
	public img: Map<string, Buffer> = new Map();
	public cache: Map<string, boolean> = new Map();

	constructor(public client: dhClient) {}

	public async getUser(user: string, guild: string): Promise<iLevel> {
		return Level.findOne({ userId: user, guildId: guild });
	}

	public async createUser(user: string, guild: string): Promise<iLevel> {
		return Level.create({ userId: user, guildId: guild, colour: this.client.hex, level: 1, xp: 0 });
	}

	public generateXP(xp: number = 0): number {
		return xp + (Math.floor(Math.random() * 16) + 4) * this.boost;
	}

	public async updateUser(
		user: string,
		guild: string,
		data: { userId?: string; guildId?: string; level?: number; xp?: number; colour?: string }
	): Promise<{ lvl: iLevel; lvlUp: boolean }> {
		let lvlUp: boolean = false;
		if (data.xp) {
			if (this.cache.has(user + guild)) return null;

			this.cache.set(user + guild, true);
			setTimeout(() => this.cache.delete(user + guild), 6e4);

			const lvl = await this.getUser(user, guild);
			const required = lvl.level * 75;

			if ((required - data.xp || 0) <= 0) {
				data.level = lvl.level + 1;
				data.xp = data.xp - required || 0;
				lvlUp = true;
			}
		}

		return { lvl: await Level.findOneAndUpdate({ userId: user, guildId: guild }, data), lvlUp };
	}

	public async rankUser(user: GuildMember, { level }: iLevel) {
		let role: { old: string; new: string } = { old: null, new: null };
		switch (level) {
			case 5:
				role.new = "818231134445109329";
				break;
			case 10:
				role.new = "818231135325913158";
				role.old = "818231134445109329";
				break;
			case 20:
				role.new = "818231135992545320";
				role.old = "818231135325913158";
				break;
			case 30:
				role.new = "818231137687306271";
				role.old = "818231135992545320";
				break;
			case 40:
				role.new = "818231137691238470";
				role.old = "818231137687306271";
				break;
			case 50:
				role.new = "818233328984522814";
				role.old = "818231137691238470";
				break;
			case 60:
				role.new = "818233330414780426";
				role.old = "818233328984522814";
				break;
			default:
				break;
		}

		if (role.new) await user.roles.add(role.new).catch((e) => null);
		if (role.old) await user.roles.remove(role.old).catch((e) => null);
	}

	public async getCard(user: User, data: iLevel): Promise<MessageAttachment> {
		const ranks = (await Level.find({ guildId: data.guildId }))
			.sort((a, b) => b.level * 75 + b.xp - (a.level * 75 + a.xp))
			.map((l, i) => {
				return { level: l, i };
			});
		const buffer =
			this.img.get(user.id + data.guildId) ||
			(await new Rank()
				.setAvatar(user.displayAvatarURL({ dynamic: false, size: 4096, format: "png" }))
				.setCurrentXP(data.xp)
				.setRequiredXP(data.level * 75)
				.setCustomStatusColor(data.colour || this.client.hex)
				.setProgressBar(data.colour || this.client.hex, "COLOR")
				.setUsername(user.username)
				.setDiscriminator(user.discriminator)
				.setRank((ranks.find((r) => r.level.userId === user.id)?.i || 0) + 1, "Rank")
				.setLevel(data.level, "Level")
				.setLevelColor(data.colour || this.client.hex)
				.build());

		if (!this.img.has(user.id + data.guildId)) {
			this.img.set(user.id + data.guildId, buffer);
			setTimeout(() => this.img.delete(user.id + data.guildId));
		}

		return new MessageAttachment(buffer, "rankcard.png");
	}
}