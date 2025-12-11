import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Column<T = Record<string, unknown>> {
	key: string;
	label: string;
	render?: (value: unknown, row: T) => React.ReactNode;
	truncate?: boolean;
}

interface DataTableProps<T = Record<string, unknown>> {
	title?: string;
	description?: string;
	columns: Column<T>[];
	data: T[];
	maxHeight?: string;
	showDownload?: boolean;
	onDownload?: () => void;
	downloadLabel?: string;
}

export const DataTable = <T extends Record<string, unknown>>({
	title,
	description,
	columns,
	data,
	maxHeight = "h-[400px]",
	showDownload = false,
	onDownload,
	downloadLabel = "Unduh CSV",
}: DataTableProps<T>) => {
	return (
		<Card>
			{(title || showDownload) && (
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							{title && <CardTitle>{title}</CardTitle>}
							{description && <CardDescription>{description}</CardDescription>}
						</div>
						{showDownload && onDownload && (
							<Button onClick={onDownload} variant="outline" size="sm">
								<Download className="mr-2 h-4 w-4" />
								{downloadLabel}
							</Button>
						)}
					</div>
				</CardHeader>
			)}
			<CardContent>
				<ScrollArea className={`w-full rounded border ${maxHeight}`}>
					<div className="p-4">
						<div className="space-y-4">
							{data.map((row, rowIndex) => (
								<div key={rowIndex} className="border rounded-lg p-4 space-y-2">
									{columns.map((column) => (
										<div key={column.key} className="flex justify-between">
											<span className="font-medium">{column.label}:</span>
											<span
												className={`text-right ${
													column.truncate ? "truncate max-w-xs" : ""
												}`}
											>
												{column.render
													? column.render(
															(row as Record<string, unknown>)[column.key],
															row
													  )
													: String(
															(row as Record<string, unknown>)[column.key] ||
																"-"
													  )}
											</span>
										</div>
									))}
								</div>
							))}
						</div>
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
};
