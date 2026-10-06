import mongoose, { Schema, type Document, type Types } from "mongoose";
import { COMPANY_ROLES, type CompanyRole } from "../taxonomy.js";

export interface ICompanyMember extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  userId: string;
  role: CompanyRole;
  invitedBy?: string;
  createdAt: Date;
}

const companyMemberSchema = new Schema<ICompanyMember>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: COMPANY_ROLES, required: true },
    invitedBy: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

companyMemberSchema.index({ companyId: 1, userId: 1 }, { unique: true });
companyMemberSchema.index({ userId: 1 });

export const CompanyMember = mongoose.model<ICompanyMember>("CompanyMember", companyMemberSchema);
