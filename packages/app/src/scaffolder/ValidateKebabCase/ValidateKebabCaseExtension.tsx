import {
  FieldExtensionComponentProps,
  makeFieldSchema,
  ScaffolderRJSFFieldProps,
} from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';

export const ValidateKebabCaseValidationSchema = makeFieldSchema({
  output: z => z.string(),
});

export const ValidateKebabCase = (
  props: FieldExtensionComponentProps<string>,
) => {
  const { onChange, rawErrors, required, formData } =
    props as ScaffolderRJSFFieldProps<string>;

  return (
    <FormControl
      margin="normal"
      required={required}
      error={rawErrors?.length > 0 && !formData}
    >
      <InputLabel>Name</InputLabel>
      <Input
        id="validateName"
        aria-describedby="entityName"
        value={formData ?? ''}
        onChange={e => onChange(e.target?.value)}
      />
      <FormHelperText id="entityName">
        Use only letters, numbers, hyphens and underscores
      </FormHelperText>
    </FormControl>
  );
};

export const validateKebabCaseValidation = (
  value: string,
  validation: FieldValidation,
) => {
  const kebabCase = /^[a-z0-9-_]+$/g.test(value);

  if (kebabCase === false) {
    validation.addError(
      `Only use letters, numbers, hyphen ("-") and underscore ("_").`,
    );
  }
};
