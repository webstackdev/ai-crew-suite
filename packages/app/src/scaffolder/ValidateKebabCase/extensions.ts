import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';
import {
  ValidateKebabCase,
  validateKebabCaseValidation,
  ValidateKebabCaseValidationSchema,
} from './ValidateKebabCaseExtension';

export const ValidateKebabCaseFieldExtension = FormFieldBlueprint.make({
  name: 'validate-kebab-case',
  params: {
    field: async () =>
      createFormField({
        name: 'ValidateKebabCase',
        component: ValidateKebabCase,
        schema: ValidateKebabCaseValidationSchema,
        validation: validateKebabCaseValidation,
      }),
  },
});
