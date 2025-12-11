import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ActionButton {
	id: string;
	label: string;
	onClick: () => void;
	variant?:
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link";
	disabled?: boolean;
	loading?: boolean;
	icon?: React.ReactNode;
	className?: string;
}

interface ActionButtonsProps {
	buttons: ActionButton[];
	layout?: "horizontal" | "vertical";
	gap?: string;
	justify?: "start" | "center" | "end" | "between";
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
	buttons,
	layout = "horizontal",
	gap = "gap-2",
	justify = "start",
}) => {
	const containerClasses =
		layout === "vertical"
			? `flex flex-col ${gap}`
			: `flex flex-col sm:flex-row ${gap} ${
					justify === "center"
						? "justify-center"
						: justify === "end"
						? "justify-end"
						: justify === "between"
						? "justify-between"
						: "justify-start"
			  }`;

	return (
		<div className={containerClasses}>
			{buttons.map((button) => (
				<Button
					key={button.id}
					onClick={button.onClick}
					variant={button.variant || "default"}
					disabled={button.disabled || button.loading}
					className={`w-full sm:w-auto ${button.className || ""}`}
				>
					{button.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{!button.loading && button.icon && (
						<span className="mr-2">{button.icon}</span>
					)}
					{button.label}
				</Button>
			))}
		</div>
	);
};
