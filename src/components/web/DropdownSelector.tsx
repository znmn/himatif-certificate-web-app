import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DropdownSelectorProps<T extends string> {
	id?: string;
	label: string;
	value: T;
	onValueChange: (value: T) => void;
	options: T[];
	formatOption?: (option: T) => string;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	menuLabel?: string;
	className?: string;
}

export function DropdownSelector<T extends string>({
	id,
	label,
	value,
	onValueChange,
	options,
	formatOption = (option: T) =>
		option.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
	placeholder = "Select option",
	disabled = false,
	required = false,
	menuLabel,
	className,
}: DropdownSelectorProps<T>) {
	const handleValueChange = (newValue: string) => {
		onValueChange(newValue as T);
	};

	return (
		<div className={`space-y-2 ${className || ""}`}>
			<Label htmlFor={id}>
				{label} {required && <span className="text-destructive">*</span>}
			</Label>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						id={id}
						variant="outline"
						className="w-full justify-start"
						disabled={disabled}
					>
						{value ? formatOption(value) : placeholder}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56">
					{menuLabel && <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>}
					{menuLabel && <DropdownMenuSeparator />}
					<DropdownMenuRadioGroup
						value={value}
						onValueChange={handleValueChange}
					>
						{options.map((option) => (
							<DropdownMenuRadioItem key={option} value={option}>
								{formatOption(option)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
