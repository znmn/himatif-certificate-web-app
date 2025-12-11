import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ProgressCardProps {
	title?: string;
	description?: string;
	progress: number;
	statusText?: string;
	isActive?: boolean;
	showProgressBar?: boolean;
	className?: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
	title = "Memproses...",
	description,
	progress,
	statusText,
	isActive = true,
	showProgressBar = true,
	className,
}) => {
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{isActive && <Loader2 className="h-5 w-5 animate-spin" />}
					{title}
				</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			{showProgressBar && (
				<CardContent>
					<div className="space-y-2">
						<div className="flex justify-between text-sm">
							<span>{statusText || "Memproses file..."}</span>
							<span>{Math.round(progress)}%</span>
						</div>
						<Progress value={progress} />
					</div>
				</CardContent>
			)}
		</Card>
	);
};
