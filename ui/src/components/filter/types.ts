export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterFieldDef {
  key: string;
  label: string;
  type: "multi" | "single" | "text";
  /** Static options list. Takes precedence over loadOptions. */
  options?: FilterOption[];
  /** Async loader called once on first panel open for this field. */
  loadOptions?: () => Promise<FilterOption[]>;
  placeholder?: string;
}
