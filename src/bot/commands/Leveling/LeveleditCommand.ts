import { Command } from "../../../client/structures/extensions";
import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { emojis } from "../../../client/constants";
import { GuildMessage } from "../../../client/structures/Moderation";

@ApplyOptions<Command.Options>({
	name: "leveledit",
	description: "Edits the level/xp of someone",
	usage: "<user> <type = 'xp' | 'level'> <value>",
	preconditions: ["GuildOnly", "ManagerOnly"],
})
export default class LeveleditCommand extends Command {
	public async run(message: GuildMessage, args: Args) {
		const { value: member } = await args.pickResult("member");
		const { value: type } = await args.pickResult("string");
		const { value } = await args.pickResult("number");
		if (!member) return message.reply(`>>> ${emojis.redcross} | No member provided.`);
		if (!value) return message.reply(`>>> ${emojis.redcross} | No value provided.`);

		const level = await this.client.prisma.level.findFirst({
			where: { id: `${member.id}-${message.guildId}` },
		});
		if (!level)
			return message.reply(`>>> ${emojis.redcross} | No leveling stats found for this user.`);

		switch (type) {
			case "xp":
				level.xp = value;
				break;
			case "level":
				level.level = value;
				break;
			default:
				return message.reply(
					`>>> ${emojis.redcross} | The provided type is not one of "xp", "level".`
				);
		}

		await this.client.prisma.level.update({ where: { id: level.id }, data: level });
		await message.reply(
			`>>> ${emojis.greentick} | Successfully updated the **${type}** of **${member.user.tag}** to \`${value}\`!`
		);
	}
}