import { Areas } from "./areas";
import { ColorRoles } from "./color-roles";
import { Palette } from "./palette";
import { Scales } from "./scales";
import { Typography } from "./typography";

export function Foundations() {
	return (
		<div className="space-y-14">
			<ColorRoles />
			<Palette />
			<Areas />
			<Typography />
			<Scales />
		</div>
	);
}
