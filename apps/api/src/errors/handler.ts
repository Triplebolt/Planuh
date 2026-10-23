import {
  AllocationAlreadyAssignedError,
  AllocationNotFoundError,
  ArchivedSegmentValueError,
  DuplicateSegmentNameError,
  NoSegmentTypeError,
  SegmentTypeInUseError,
  SegmentTypeNotFoundError,
  SegmentValueInUseError,
  SegmentValueNotFoundError,
  SegmentValueTypeMismatchError,
  SplitAmountMismatchError,
} from '@plannuh/domain';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { MissingAuthContextError } from '../auth/context.js';
import { ForbiddenError } from '../auth/require-role.js';

/**
 * Domain errors are typed classes; this is the one place they map to HTTP
 * codes, so no route returns a raw database error.
 */
export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    reply
      .code(400)
      .send({ error: 'validation_error', field: issue?.path.join('.'), message: issue?.message });
    return;
  }
  if (error instanceof MissingAuthContextError) {
    reply.code(401).send({ error: 'unauthenticated', message: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    reply.code(403).send({ error: 'forbidden', message: error.message });
    return;
  }
  if (error instanceof DuplicateSegmentNameError) {
    reply.code(409).send({ error: 'duplicate_name', message: error.message });
    return;
  }
  if (error instanceof NoSegmentTypeError) {
    reply.code(422).send({ error: 'no_segment_type', message: error.message });
    return;
  }
  if (error instanceof SegmentValueInUseError) {
    reply.code(409).send({
      error: 'segment_value_in_use',
      canArchive: error.canArchive,
      message: error.message,
    });
    return;
  }
  if (error instanceof SegmentTypeInUseError) {
    reply.code(409).send({ error: 'segment_type_in_use', message: error.message });
    return;
  }
  if (error instanceof SplitAmountMismatchError) {
    reply.code(422).send({
      error: 'split_amount_mismatch',
      expected: error.expected.toString(),
      actual: error.actual.toString(),
      message: error.message,
    });
    return;
  }
  if (error instanceof ArchivedSegmentValueError) {
    reply.code(422).send({ error: 'archived_segment_value', message: error.message });
    return;
  }
  if (
    error instanceof SegmentTypeNotFoundError ||
    error instanceof SegmentValueNotFoundError ||
    error instanceof AllocationNotFoundError
  ) {
    reply.code(404).send({ error: 'not_found', message: error.message });
    return;
  }
  if (error instanceof SegmentValueTypeMismatchError) {
    reply.code(422).send({ error: 'segment_value_type_mismatch', message: error.message });
    return;
  }
  if (error instanceof AllocationAlreadyAssignedError) {
    reply.code(409).send({ error: 'allocation_already_assigned', message: error.message });
    return;
  }

  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
  reply.code(statusCode).send({
    error: 'internal_error',
    message: statusCode >= 500 ? 'Internal error' : error.message,
  });
}
