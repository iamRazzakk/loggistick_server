import { FilterQuery, Query } from "mongoose";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Never filter, sort or select by these (e.g. password hash oracle).
const BLOCKED_FIELDS = ["password", "tokenVersion"];
const isBlockedField = (field: string) =>
  BLOCKED_FIELDS.some(
    (blocked) => field === blocked || field.startsWith(`${blocked}.`),
  );

const isPrimitive = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * Query-string values are user input. Only plain values (or arrays of plain
 * values) are allowed — objects such as {"$regex": ...} / {"$ne": ...} and
 * keys starting with "$" are dropped, so no MongoDB operators can be injected.
 */
const sanitizeFilter = (input: Record<string, unknown>) => {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("$") || isBlockedField(key)) continue;
    if (isPrimitive(value)) {
      safe[key] = value;
    } else if (Array.isArray(value) && value.every(isPrimitive)) {
      safe[key] = { $in: value };
    }
  }
  return safe;
};

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  //searching
  search(searchableFields: string[]) {
    const term = this?.query?.searchTerm;
    if (typeof term === "string" && term.trim()) {
      // Escape so the search text is matched literally (no regex / ReDoS).
      const safeTerm = escapeRegex(term.trim().slice(0, 100));
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: {
                $regex: safeTerm,
                $options: "i",
              },
            }) as FilterQuery<T>,
        ),
      });
    }
    return this;
  }

  //filtering
  filter() {
    const queryObj = { ...this.query };
    const excludeFields = ["searchTerm", "sort", "page", "limit", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    // Handle price range specially: ?price[min]=10&price[max]=50
    const priceRaw = queryObj["price"];
    delete queryObj["price"];

    const safeFilter = sanitizeFilter(queryObj);

    if (priceRaw && typeof priceRaw === "object") {
      const priceObj = priceRaw as { min?: unknown; max?: unknown };
      const priceFilter: Record<string, number> = {};
      const min = Number(priceObj.min);
      const max = Number(priceObj.max);
      if (priceObj.min !== undefined && Number.isFinite(min)) {
        priceFilter.$gte = min;
      }
      if (priceObj.max !== undefined && Number.isFinite(max)) {
        priceFilter.$lte = max;
      }
      if (Object.keys(priceFilter).length) safeFilter.price = priceFilter;
    } else if (isPrimitive(priceRaw)) {
      safeFilter.price = priceRaw;
    }

    this.modelQuery = this.modelQuery.find(safeFilter as FilterQuery<T>);
    return this;
  }

  //sorting
  sort() {
    const raw = typeof this?.query?.sort === "string" ? this.query.sort : "";
    const sort =
      raw
        .split(/[\s,]+/)
        .filter((field) => field && !isBlockedField(field.replace(/^-/, "")))
        .join(" ") || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sort);

    return this;
  }

  //pagination
  paginate() {
    let limit = Number(this?.query?.limit) || 10;
    let page = Number(this?.query?.page) || 1;
    let skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    return this;
  }

  //fields filtering
  fields() {
    // "+field" would force-select hidden fields (e.g. +password) — not allowed.
    const raw = typeof this?.query?.fields === "string" ? this.query.fields : "";
    const fields =
      raw
        .split(",")
        .map((field) => field.trim())
        .filter(
          (field) =>
            field &&
            !field.startsWith("+") &&
            !isBlockedField(field.replace(/^-/, "")),
        )
        .join(" ") || "-__v";
    this.modelQuery = this.modelQuery.select(fields);

    return this;
  }

  //populating
  populate(populateFields: string[], selectFields: Record<string, unknown>) {
    this.modelQuery = this.modelQuery.populate(
      populateFields.map((field) => ({
        path: field,
        select: selectFields[field],
      })),
    );
    return this;
  }

  //pagination information
  async getPaginationInfo() {
    const total = await this.modelQuery.model.countDocuments(
      this.modelQuery.getFilter(),
    );
    const limit = Number(this?.query?.limit) || 10;
    const page = Number(this?.query?.page) || 1;
    const totalPage = Math.ceil(total / limit);

    return {
      total,
      limit,
      page,
      totalPage,
    };
  }
}

export default QueryBuilder;
