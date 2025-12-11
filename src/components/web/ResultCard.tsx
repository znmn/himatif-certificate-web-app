import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, AlertCircle } from "lucide-react";

interface ResultItem {
	id: string;
	title: string;
	subtitle?: string;
	status?: "success" | "error" | "warning" | "info";
	badge?: string;
	details: Array<{
		label: string;
		value: string | number;
		truncate?: boolean;
		link?: string;
	}>;
	url?: {
		label: string;
		value: string;
	};
	downloadable?: boolean;
	onDownload?: () => void;
}

interface ResultCardProps {
	title: string;
	description?: string;
	items: ResultItem[];
	headerActions?: React.ReactNode;
	overallStatus?: "success" | "error" | "warning" | "mixed";
}

export const ResultCard: React.FC<ResultCardProps> = ({
	title,
	description,
	items,
	headerActions,
	overallStatus,
}) => {
	const getStatusIcon = (status?: string) => {
		switch (status) {
			case "success":
				return <CheckCircle className="h-5 w-5 text-green-500" />;
			case "error":
				return <AlertCircle className="h-5 w-5 text-red-500" />;
			case "warning":
				return <AlertCircle className="h-5 w-5 text-yellow-500" />;
			default:
				return <CheckCircle className="h-5 w-5 text-blue-500" />;
		}
	};

	const getOverallIcon = () => {
		if (overallStatus === "success") {
			return <CheckCircle className="h-5 w-5 text-green-500" />;
		} else if (overallStatus === "error") {
			return <AlertCircle className="h-5 w-5 text-red-500" />;
		} else if (overallStatus === "warning") {
			return <AlertCircle className="h-5 w-5 text-yellow-500" />;
		}
		return <CheckCircle className="h-5 w-5 text-blue-500" />;
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{overallStatus && getOverallIcon()}
						<div>
							<CardTitle>{title}</CardTitle>
							{description && <CardDescription>{description}</CardDescription>}
						</div>
					</div>
					{headerActions}
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{items.map((item) => (
						<div key={item.id} className="border rounded-lg p-4">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<h4 className="font-medium truncate flex-1 min-w-0">
										{item.title}
									</h4>
									{item.status && getStatusIcon(item.status)}
									{item.badge && (
										<Badge
											variant={
												item.status === "success"
													? "default"
													: item.status === "error"
													? "destructive"
													: item.status === "warning"
													? "secondary"
													: "outline"
											}
											className={`shrink-0 ${
												item.status === "success"
													? "bg-green-500"
													: item.status === "error"
													? ""
													: ""
											}`}
										>
											{item.badge}
										</Badge>
									)}
								</div>
								{item.downloadable && item.onDownload && (
									<Button
										size="sm"
										onClick={item.onDownload}
										className="shrink-0"
									>
										<Download className="h-4 w-4" />
										{/* <span className="hidden sm:inline ml-2">Unduh</span> */}
									</Button>
								)}
							</div>
							{item.subtitle && (
								<p className="text-sm text-muted-foreground mb-2">
									{item.subtitle}
								</p>
							)}
							<div className="text-sm text-muted-foreground space-y-1 overflow-x-auto">
								<div className="flex flex-col gap-1 min-w-0">
									{item.details.map((detail, index) => (
										<p
											key={index}
											className={detail.truncate ? "truncate" : ""}
										>
											<strong>{detail.label}:</strong>{" "}
											{detail.link ? (
												<a
													href={detail.link}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-600 hover:underline break-all"
												>
													{detail.value}
												</a>
											) : (
												<span className={detail.truncate ? "break-all" : ""}>
													{detail.value}
												</span>
											)}
										</p>
									))}
								</div>
							</div>
							{item.details.length > 0 && <Separator className="my-2" />}
							{item.url && (
								<div className="text-xs text-muted-foreground overflow-x-auto">
									<strong>{item.url.label}:</strong>
									<a
										href={item.url.value}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:underline break-all ml-1"
										style={{ wordBreak: "break-all" }}
									>
										{item.url.value}
									</a>
								</div>
							)}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};
