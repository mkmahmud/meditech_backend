import { ApiBody } from '@nestjs/swagger';
import { z, ZodTypeAny } from 'zod';

function unwrapSchema(schema: ZodTypeAny): { schema: ZodTypeAny; required: boolean; nullable: boolean } {
  let current = schema;
  let required = true;
  let nullable = false;

  while (current?._def) {
    const typeName = current._def.typeName;

    if (typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
      required = false;
      current = current._def.innerType;
      continue;
    }

    if (typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
      required = false;
      current = current._def.innerType;
      continue;
    }

    if (typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
      nullable = true;
      current = current._def.innerType;
      continue;
    }

    if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    break;
  }

  return { schema: current, required, nullable };
}

function getStringFormat(schema: ZodTypeAny) {
  const checks = schema._def.checks || [];

  if (checks.some((check: any) => check.kind === 'email')) return 'email';
  if (checks.some((check: any) => check.kind === 'uuid')) return 'uuid';
  if (checks.some((check: any) => check.kind === 'url')) return 'uri';
  if (checks.some((check: any) => check.kind === 'datetime')) return 'date-time';

  return undefined;
}

function zodToOpenApiSchema(schema: ZodTypeAny): any {
  const { schema: unwrapped, nullable } = unwrapSchema(schema);
  const typeName = unwrapped._def.typeName;
  let openApiSchema: any;

  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape =
        typeof unwrapped._def.shape === 'function'
          ? unwrapped._def.shape()
          : unwrapped._def.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      Object.entries(shape).forEach(([key, value]) => {
        const field = unwrapSchema(value as ZodTypeAny);
        properties[key] = zodToOpenApiSchema(value as ZodTypeAny);

        if (field.required) {
          required.push(key);
        }
      });

      openApiSchema = {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
      };
      break;
    }

    case z.ZodFirstPartyTypeKind.ZodArray:
      openApiSchema = {
        type: 'array',
        items: zodToOpenApiSchema(unwrapped._def.type),
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodString:
      openApiSchema = {
        type: 'string',
        ...(getStringFormat(unwrapped) ? { format: getStringFormat(unwrapped) } : {}),
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodNumber:
      openApiSchema = {
        type: 'number',
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodBoolean:
      openApiSchema = {
        type: 'boolean',
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodDate:
      openApiSchema = {
        type: 'string',
        format: 'date-time',
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodEnum:
      openApiSchema = {
        type: 'string',
        enum: unwrapped._def.values,
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodNativeEnum:
      openApiSchema = {
        type: 'string',
        enum: Object.values(unwrapped._def.values).filter((value) => typeof value === 'string'),
      };
      break;

    case z.ZodFirstPartyTypeKind.ZodRecord:
      openApiSchema = {
        type: 'object',
        additionalProperties: true,
      };
      break;

    default:
      openApiSchema = {
        type: 'object',
      };
  }

  return nullable ? { ...openApiSchema, nullable: true } : openApiSchema;
}

export const ApiZodBody = (schema: ZodTypeAny) =>
  ApiBody({
    schema: zodToOpenApiSchema(schema),
  });
