import {
  MAX_PROJECT_NAME_LENGTH,
  validateAddObservation,
  validateBulkAddObservations,
  validateCreateProject,
  validateUpdateProject,
} from './projects.validation';

describe('projects.validation', () => {
  it('requires a non-empty project name', () => {
    expect(() => validateCreateProject({ name: '   ' })).toThrow();
    expect(() =>
      validateCreateProject({ name: 'a'.repeat(MAX_PROJECT_NAME_LENGTH + 1) }),
    ).toThrow();
  });

  it('accepts create with optional description', () => {
    expect(
      validateCreateProject({
        name: '  Final Year Project ',
        description: ' Notes ',
      }),
    ).toEqual({
      name: 'Final Year Project',
      description: 'Notes',
    });
  });

  it('requires at least one update field', () => {
    expect(() => validateUpdateProject({})).toThrow();
  });

  it('validates membership payloads', () => {
    expect(validateAddObservation({ observationId: ' obs_1 ' })).toBe('obs_1');
    expect(
      validateBulkAddObservations({
        observationIds: ['a', 'a', 'b'],
      }),
    ).toEqual(['a', 'b']);
    expect(() => validateBulkAddObservations({ observationIds: [] })).toThrow();
  });
});
