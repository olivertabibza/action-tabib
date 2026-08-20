import { z } from "zod";

import {
  COMPENSATION,
  PAY_UNITS,
  PROJECT_DISCIPLINES,
  PROJECT_TYPES,
  ROLE_BILLINGS,
  ROLE_GENDERS,
} from "@/lib/marketplace";

/**
 * A whole number typed into an OPTIONAL numeric input. An empty `<input
 * type="number">` reads as "", which becomes null — the columns behind these
 * (pay_min/pay_max, age_min/age_max) are nullable, and null is a real value
 * here ("no pay range", "no age range"), not a missing one.
 */
export function toOptionalInt(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

const optionalAge = z
  .number()
  .int("Use a whole number.")
  .min(0, "Age can't be negative.")
  .max(120, "That age looks too high.")
  .nullable();

const optionalPay = z
  .number()
  .int("Use a whole number.")
  .min(0, "Pay can't be negative.")
  .max(10_000_000, "That figure looks too high.")
  .nullable();

/**
 * One open role on a production (public.project_roles). `sort_order` is NOT
 * here — it is the role's index in the array, assigned server-side.
 *
 * Mirrors the table's own CHECK: age_min <= age_max when both are present.
 * Both are nullable because a crew role has no age range at all.
 */
export const projectRoleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Every role needs a name.")
      .max(120, "Keep the role name under 120 characters."),
    billing: z.enum(ROLE_BILLINGS),
    gender: z.enum(ROLE_GENDERS),
    age_min: optionalAge,
    age_max: optionalAge,
    description: z
      .string()
      .trim()
      .max(500, "Keep the role description under 500 characters."),
  })
  .refine(
    (role) =>
      role.age_min === null ||
      role.age_max === null ||
      role.age_min <= role.age_max,
    { message: "The minimum age can't be above the maximum.", path: ["age_max"] }
  );

export type ProjectRoleFormValues = z.infer<typeof projectRoleSchema>;

/** A blank role row, for the "Add a role" button and the first render. */
export const emptyRole: ProjectRoleFormValues = {
  name: "",
  billing: "supporting",
  gender: "any",
  age_min: null,
  age_max: null,
  description: "",
};

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;
/** A production with more open roles than this is almost certainly a mistake. */
const MAX_ROLES = 25;

/**
 * Validation for posting a project. Shared by the client form (instant
 * feedback) and the server action (never trust the client).
 *
 * staff_pick is deliberately ABSENT: the projects_guard_staff_pick trigger
 * (supabase/project-roles.sql §2) forces it to false for any non-admin caller,
 * so a field for it would be a lie — the form would accept the value and the
 * database would silently drop it.
 */
export const projectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Please add a title.")
      .max(120, "Keep the title under 120 characters."),
    project_type: z.enum(PROJECT_TYPES, {
      error: "Please pick a project type.",
    }),
    disciplines: z
      .array(z.enum(PROJECT_DISCIPLINES))
      .min(1, "Pick at least one discipline."),
    description: z
      .string()
      .trim()
      .min(1, "Please describe the project.")
      .max(2000, "Keep the description under 2000 characters."),
    location: z
      .string()
      .trim()
      .min(1, "Please add a location.")
      .max(120, "Keep the location under 120 characters."),
    compensation: z.enum(COMPENSATION),
    pay_min: optionalPay,
    pay_max: optionalPay,
    pay_unit: z.enum(PAY_UNITS),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(MAX_TAG_LENGTH, `Keep tags under ${MAX_TAG_LENGTH} characters.`)
      )
      .max(MAX_TAGS, `Up to ${MAX_TAGS} tags.`),
    // Zero roles is VALID — that is the crew-call shape the nullable
    // applications.role_id exists for.
    roles: z.array(projectRoleSchema).max(MAX_ROLES, `Up to ${MAX_ROLES} roles.`),
  })
  // Mirrors projects_pay_range_check (supabase/project-roles.sql §1).
  .refine(
    (values) =>
      values.pay_min === null ||
      values.pay_max === null ||
      values.pay_min <= values.pay_max,
    { message: "The minimum pay can't be above the maximum.", path: ["pay_max"] }
  );

export type ProjectFormValues = z.infer<typeof projectSchema>;

/** Validation for applying to a project. The note may be left blank. */
export const applicationSchema = z.object({
  note: z.string().trim().max(1000, "Keep your note under 1000 characters."),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;
