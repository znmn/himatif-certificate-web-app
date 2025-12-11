import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BaseFormFieldProps {
	id: string;
	label: string;
	required?: boolean;
	description?: string;
	error?: string;
	disabled?: boolean;
	className?: string;
}

interface TextFormFieldProps extends BaseFormFieldProps {
	type: "text" | "email" | "password" | "number";
	value: string | number;
	onChange: (value: string) => void;
	placeholder?: string;
}

interface TextareaFormFieldProps extends BaseFormFieldProps {
	type: "textarea";
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	rows?: number;
}

type FormFieldProps = TextFormFieldProps | TextareaFormFieldProps;

export const FormField: React.FC<FormFieldProps> = ({
	id,
	label,
	required = false,
	description,
	error,
	disabled = false,
	className,
	...props
}) => {
	const renderInput = () => {
		if (props.type === "textarea") {
			const { value, onChange, placeholder, rows = 3 } = props;
			return (
				<Textarea
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					rows={rows}
					disabled={disabled}
					required={required}
					className={error ? "border-destructive" : ""}
				/>
			);
		} else {
			const { type, value, onChange, placeholder } = props;
			return (
				<Input
					id={id}
					type={type}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					disabled={disabled}
					required={required}
					className={error ? "border-destructive" : ""}
				/>
			);
		}
	};

	return (
		<div className={`space-y-2 ${className || ""}`}>
			<Label htmlFor={id}>
				{label} {required && <span className="text-destructive">*</span>}
			</Label>
			{renderInput()}
			{description && (
				<p className="text-sm text-muted-foreground">{description}</p>
			)}
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
};
