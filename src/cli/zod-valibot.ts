#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { program } from "commander";
import axios from "axios";

// Types
interface Column {
  name: string;
  table: string;
  data_type: string;
  is_nullable: boolean;
  default_value: any;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  is_generated: boolean;
  generation_expression: string | null;
  is_unique: boolean;
  is_primary_key: boolean;
  has_auto_increment: boolean;
  foreign_key_column: string | null;
  foreign_key_table: string | null;
}

interface TableSchema {
  columns: Column[];
  foreignKeys: any[];
}

interface DatabaseSchema {
  [tableName: string]: TableSchema;
}

// SQL type to Zod/Valibot type mapping
const typeMapping = {
  // String types
  varchar: {
    zod: "z.string()",
    valibot: "string()",
    tsType: "string",
  },
  text: {
    zod: "z.string()",
    valibot: "string()",
    tsType: "string",
  },
  string: {
    zod: "z.string()",
    valibot: "string()",
    tsType: "string",
  },

  // Numeric types
  integer: {
    zod: "z.number().int()",
    valibot: "number()",
    tsType: "number",
  },
  increments: {
    zod: "z.number().int().positive()",
    valibot: "number()",
    tsType: "number",
  },
  bigInteger: {
    zod: "z.bigint()",
    valibot: "bigint()",
    tsType: "bigint",
  },
  decimal: {
    zod: "z.number()",
    valibot: "number()",
    tsType: "number",
  },
  float: {
    zod: "z.number()",
    valibot: "number()",
    tsType: "number",
  },

  // Date/Time types
  datetime: {
    zod: "z.date()",
    valibot: "date()",
    tsType: "Date",
  },
  date: {
    zod: "z.date()",
    valibot: "date()",
    tsType: "Date",
  },
  time: {
    zod: "z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)",
    valibot:
      "string([regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)])",
    tsType: "string",
  },
  timestamp: {
    zod: "z.date()",
    valibot: "date()",
    tsType: "Date",
  },

  // Other types
  boolean: {
    zod: "z.boolean()",
    valibot: "boolean()",
    tsType: "boolean",
  },
  binary: {
    zod: "z.instanceof(Buffer)",
    valibot: "instance(Buffer)",
    tsType: "Buffer",
  },
  json: {
    zod: "z.record(z.any())",
    valibot: "record(string(),any())",
    tsType: "Record<string, any>",
  },
  uuid: {
    zod: "z.string().uuid()",
    valibot: "uuid()",
    tsType: "string",
  },
};

function generateZodSchema(tableName: string, columns: Column[]): string {
  const properties = columns.map((column) => {
    const baseType =
      typeMapping[column.data_type as keyof typeof typeMapping]?.zod ||
      "z.any()";
    let schemaType = baseType;

    // Add validations based on column properties
    if (column.max_length) {
      schemaType = `${baseType}.max(${column.max_length})`;
    }

    if (column.is_nullable) {
      schemaType = `${schemaType}.nullable()`;
    }

    return `  ${column.name}: ${schemaType}`;
  });

  return `export const ${tableName}Schema = z.object({
${properties.join(",\n")}
});

export type ${capitalizeFirstLetter(
    tableName
  )} = z.infer<typeof ${tableName}Schema>;`;
}

function generateValibotSchema(tableName: string, columns: Column[]): string {
  const properties = columns.map((column) => {
    const baseType =
      typeMapping[column.data_type as keyof typeof typeMapping]?.valibot ||
      "any()";
    let schemaType = baseType;

    // Add validations based on column properties
    if (column.max_length) {
      schemaType = `${baseType}.pipe(maxLength(${column.max_length}))`;
    }

    if (column.is_nullable) {
      schemaType = `nullable(${schemaType})`;
    }

    return `  ${column.name}: ${schemaType}`;
  });

  return `export const ${tableName}Schema = object({
${properties.join(",\n")}
});

export type ${capitalizeFirstLetter(
    tableName
  )} = Input<typeof ${tableName}Schema>;`;
}

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateValidationSchemas(
  schema: DatabaseSchema,
  type: "zod" | "valibot" | "both"
): string {
  const imports = [];
  const schemas = [];

  if (type === "zod" || type === "both") {
    imports.push('import { z } from "zod";');
  }

  if (type === "valibot" || type === "both") {
    imports.push(`import { 
    string, 
    number,
    bigint,
    boolean,
    date,
    object,
    record,
    unknown,
    nullable,
    type Input,
    uuid,
    maxLength,
    integer,
    minValue,
    regex,
    instance,
    any
  } from "valibot";`);
  }

  for (const [tableName, tableSchema] of Object.entries(schema)) {
    if (type === "zod" || type === "both") {
      schemas.push(generateZodSchema(tableName, tableSchema.columns));
    }
    if (type === "valibot" || type === "both") {
      schemas.push(generateValibotSchema(tableName, tableSchema.columns));
    }
  }

  return `// Generated Validation Schemas
${imports.join("\n")}

${schemas.join("\n\n")}`;
}

async function fetchSchema(
  url: string,
  headers?: Record<string, string>
): Promise<DatabaseSchema> {
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch schema: ${error.message}`);
    }
    throw error;
  }
}

// CLI Setup
program
  .name("validation-schema-generator")
  .description("Generate Zod and/or Valibot schemas from database schema")
  .version("1.0.0")
  .requiredOption("-u, --url <url>", "API endpoint URL for schema")
  .option(
    "-o, --output <path>",
    "Output TypeScript file path",
    "validation-schemas.ts"
  )
  .option(
    "-t, --type <type>",
    "Type of schema to generate (zod, valibot, or both)",
    "both"
  )
  .option("-H, --header <headers...>", "HTTP headers (format: key=value)", [])
  .parse(process.argv);

const options = program.opts();

// Parse headers
const headers = options.header.reduce(
  (acc: Record<string, string>, curr: string) => {
    const [key, value] = curr.split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  },
  {}
);

async function main() {
  try {
    // Validate schema type option
    const schemaType = options.type.toLowerCase();
    if (!["zod", "valibot", "both"].includes(schemaType)) {
      throw new Error(
        'Invalid schema type. Must be "zod", "valibot", or "both"'
      );
    }

    // Fetch schema from API
    console.log("Fetching schema from API...");
    const schema = await fetchSchema(options.url, headers);

    // Generate validation schemas
    console.log("Generating validation schemas...");
    const output = generateValidationSchemas(
      schema,
      schemaType as "zod" | "valibot" | "both"
    );

    // Write output file
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, output);

    console.log(`Successfully generated validation schemas at ${outputPath}`);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : "Unknown error occurred"
    );
    process.exit(1);
  }
}

// main();

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error("Error running examples:", error);
    process.exit(1);
  });
}
