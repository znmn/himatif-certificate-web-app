import React, { useEffect, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
	timestamp: number;
	message: string;
	type: "info" | "success" | "error" | "warning";
}

interface LogViewerProps {
	title?: string;
	description?: string;
	logs: LogEntry[];
	maxHeight?: string;
	autoScroll?: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({
	title = "Log Real-time",
	description = "Update proses secara real-time",
	logs,
	maxHeight = "h-[300px]",
	autoScroll = false,
}) => {
	const logsEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (autoScroll && logsEndRef.current) {
			logsEndRef.current.scrollIntoView({ behavior: "auto" });
		}
	}, [logs, autoScroll]);

	const getLogClassName = (type: LogEntry["type"]) => {
		switch (type) {
			case "error":
				return "text-red-500";
			case "success":
				return "text-green-500";
			case "warning":
				return "text-yellow-500";
			case "info":
			default:
				return "text-muted-foreground";
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ScrollArea className={`w-full rounded border p-4 ${maxHeight}`}>
					<div className="space-y-1">
						{logs.map((log, index) => (
							<div
								key={index}
								className={`text-sm ${getLogClassName(log.type)}`}
							>
								[{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
							</div>
						))}
						<div ref={logsEndRef} />
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
};
