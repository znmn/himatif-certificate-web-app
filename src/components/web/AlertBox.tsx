import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

type AlertVariant = "default" | "destructive" | "success" | "warning";

interface AlertBoxProps {
	variant: AlertVariant;
	title?: string;
	message: string;
	className?: string;
}

export const AlertBox: React.FC<AlertBoxProps> = ({
	variant,
	title,
	message,
	className,
}) => {
	const getIcon = () => {
		switch (variant) {
			case "destructive":
				return <AlertCircle className="h-4 w-4" />;
			case "success":
				return <CheckCircle className="h-4 w-4" />;
			case "warning":
				return <AlertTriangle className="h-4 w-4" />;
			case "default":
			default:
				return <Info className="h-4 w-4" />;
		}
	};

	const getAlertVariant = () => {
		switch (variant) {
			case "success":
				return "default";
			case "warning":
				return "default";
			default:
				return variant;
		}
	};

	return (
		<Alert variant={getAlertVariant()} className={className}>
			{getIcon()}
			<AlertDescription>
				{title && <div className="font-medium mb-1">{title}</div>}
				<div>{message}</div>
			</AlertDescription>
		</Alert>
	);
};
