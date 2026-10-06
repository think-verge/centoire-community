import {
  COMPANY_SEGMENTS,
  COMPANY_SIZES,
  EMPLOYMENT_TYPES,
  JOB_FUNCTIONS,
  SALARY_PERIODS,
  SENIORITIES,
  WORKPLACES,
} from "../taxonomy.js";

export function getTaxonomy() {
  return {
    functions: [...JOB_FUNCTIONS],
    seniorities: [...SENIORITIES],
    employmentTypes: [...EMPLOYMENT_TYPES],
    workplaces: [...WORKPLACES],
    companySegments: [...COMPANY_SEGMENTS],
    companySizes: [...COMPANY_SIZES],
    salaryPeriods: [...SALARY_PERIODS],
  };
}
