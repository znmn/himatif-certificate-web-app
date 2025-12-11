import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

type StatusType =
	| "success"
	| "error"
	| "warning"
	| "info"
	| "pending"
	| "loading";

interface StatusBadgeProps {
	status: StatusType;
	label: string;
	showIcon?: boolean;
	size?: "sm" | "default";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
	status,
	label,
	showIcon = false,
	size = "default",
}) => {
	const getBadgeVariant = () => {
		switch (status) {
			case "success":
				return "default";
			case "error":
				return "destructive";
			case "warning":
				return "secondary";
			case "info":
			case "pending":
			case "loading":
			default:
				return "outline";
		}
	};

	const getBadgeClassName = () => {
		switch (status) {
			case "success":
				return "bg-green-500 hover:bg-green-600";
			case "error":
				return "";
			case "warning":
				return "bg-yellow-500 hover:bg-yellow-600 text-black";
			case "info":
			case "pending":
			case "loading":
			default:
				return "";
		}
	};

	const getIcon = () => {
		if (!showIcon) return null;

		switch (status) {
			case "success":
				return <CheckCircle className="h-3 w-3 mr-1" />;
			case "error":
				return <AlertCircle className="h-3 w-3 mr-1" />;
			case "warning":
				return <AlertCircle className="h-3 w-3 mr-1" />;
			case "pending":
				return <Clock className="h-3 w-3 mr-1" />;
			case "loading":
				return <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
			default:
				return null;
		}
	};

	return (
		<Badge
			variant={getBadgeVariant()}
			className={`${getBadgeClassName()} ${size === "sm" ? "text-xs" : ""}`}
		>
			{getIcon()}
			{label}
		</Badge>
	);
};
