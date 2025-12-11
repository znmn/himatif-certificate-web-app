import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet } from "lucide-react";

interface FileUploadProps {
	id: string;
	label: string;
	accept?: string;
	multiple?: boolean;
	files: File[];
	onChange: (files: File[]) => void;
	disabled?: boolean;
	description?: string;
	showFileList?: boolean;
	maxFiles?: number;
	required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
	id,
	label,
	accept = ".pdf",
	multiple = false,
	files,
	onChange,
	disabled = false,
	description,
	showFileList = true,
	maxFiles,
	required = false,
}) => {
	const handleFileChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFiles = Array.from(event.target.files || []);
			let filteredFiles = selectedFiles;

			// Filter by accept type if specified
			if (accept) {
				const acceptTypes = accept.split(",").map((type) => type.trim());
				filteredFiles = selectedFiles.filter((file) => {
					return acceptTypes.some((acceptType) => {
						if (acceptType.startsWith(".")) {
							// Check both filename extension AND MIME type for security
							const hasCorrectExtension = file.name
								.toLowerCase()
								.endsWith(acceptType.toLowerCase());

							// Map file extensions to expected MIME types for validation
							let expectedMimeType = "";
							switch (acceptType.toLowerCase()) {
								case ".pdf":
									expectedMimeType = "application/pdf";
									break;
								case ".csv":
									expectedMimeType = "text/csv";
									break;
								// Add more MIME type mappings as needed
								default:
									// For unknown extensions, just check filename
									return hasCorrectExtension;
							}

							// Both filename extension AND MIME type must match
							return hasCorrectExtension && file.type === expectedMimeType;
						}
						return file.type === acceptType;
					});
				});
			}

			// Apply maxFiles limit if specified
			if (maxFiles && filteredFiles.length > maxFiles) {
				filteredFiles = filteredFiles.slice(0, maxFiles);
			}

			onChange(filteredFiles);
		},
		[accept, maxFiles, onChange]
	);

	const getFileIcon = (file: File) => {
		if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) {
			return <FileSpreadsheet className="h-3 w-3" />;
		}
		return <FileText className="h-3 w-3" />;
	};

	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="block">
				{label} {required && <span className="text-destructive">*</span>}
			</Label>
			<div>
				<input
					id={id}
					type="file"
					accept={accept}
					multiple={multiple}
					onChange={handleFileChange}
					disabled={disabled}
					className="block w-full text-sm border rounded-lg cursor-pointer bg-background text-foreground border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 file:bg-primary file:border-0 file:text-primary-foreground file:font-semibold file:py-2 file:px-4 file:mr-3 file:rounded-lg hover:file:bg-primary/90 transition-colors"
					style={{
						padding: 0,
						border: 0,
						background: "none",
					}}
					required={required}
				/>
			</div>
			{showFileList && files.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{files.map((file, index) => (
						<Badge
							key={index}
							variant="secondary"
							className="flex items-center gap-1"
						>
							{getFileIcon(file)}
							<span className="truncate max-w-32" title={file.name}>
								{file.name}
							</span>
							<span className="text-xs opacity-70">
								({(file.size / 1024 / 1024).toFixed(2)} MB)
							</span>
						</Badge>
					))}
				</div>
			)}
			{description && (
				<p className="text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
};
