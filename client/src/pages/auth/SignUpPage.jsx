import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Checkbox, PrimaryButton, TextField, TextLink } from '../../components/index.js';
import { register } from '../../lib/auth.js';
import { capitalize, fieldErrorsFromDetails, validateSignUp } from '../../lib/authValidation.js';
import { AuthCard, FormError, SwitchFlow } from './AuthCard.jsx';
import { AuthPage } from './AuthPage.jsx';
import {
  focusFirstInvalid,
  formMessage,
  isApiError,
  usernameUnavailableMessage,
} from './authErrors.js';
import { useUsernameAvailability } from './useUsernameAvailability.js';
import styles from './SignUpPage.module.css';

const FIELDS = ['username', 'email', 'password', 'acceptTerms'];

// Sign up. Figma: sign up (232:699). API: POST /auth/register, GET /auth/username-available.
export function SignUpPage() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const termsId = useId();
  const [values, setValues] = useState({
    username: '',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const availability = useUsernameAvailability(values.username);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's message as soon as the person edits it.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setFormError('');
  }

  function showErrors(next, message = '') {
    setErrors(next);
    setFormError(message);
    focusFirstInvalid(formRef.current, FIELDS, next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const found = validateSignUp(values);
    if (!found.username && availability.status === 'unavailable') {
      found.username = usernameUnavailableMessage(availability.reason);
    }
    if (Object.keys(found).length > 0) return showErrors(found);

    setSubmitting(true);
    try {
      await register({
        username: values.username,
        email: values.email.trim(),
        password: values.password,
      });
      navigate('/', { replace: true });
    } catch (error) {
      if (isApiError(error, 400)) {
        const { byField, rest } = fieldErrorsFromDetails(error.details, FIELDS);
        showErrors(byField, rest.join(' ') || (Object.keys(byField).length ? '' : error.message));
      } else if (isApiError(error, 409)) {
        // The spec's 409 does not say which value clashed, so the message decides where it shows.
        const field = /username/i.test(error.message)
          ? 'username'
          : /email/i.test(error.message)
            ? 'email'
            : null;
        if (field) showErrors({ [field]: capitalize(error.message) });
        else showErrors({}, error.message);
      } else {
        showErrors({}, formMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const usernameError =
    errors.username ||
    (availability.status === 'unavailable' ? usernameUnavailableMessage(availability.reason) : '');

  return (
    <AuthPage title="Sign Up" message="Join PlayLoop to publish your games and review others.">
      <AuthCard ref={formRef} aria-label="Sign up" onSubmit={handleSubmit}>
        <TextField
          radius="sm"
          name="username"
          label="Username"
          placeholder="Choose a username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={values.username}
          onChange={(event) => update('username', event.target.value)}
          error={usernameError}
          hint={
            <>
              Letters, numbers and _ only.
              <br />
              This can’t be changed later.
              {availability.status === 'checking' && (
                <>
                  <br />
                  Checking…
                </>
              )}
              {availability.status === 'available' && (
                <>
                  <br />
                  Username is available.
                </>
              )}
            </>
          }
        />
        <TextField
          radius="sm"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          error={errors.email}
        />
        <TextField
          radius="sm"
          name="password"
          type="password"
          label="Password"
          placeholder="Create a password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => update('password', event.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />

        <div>
          <div className={styles.terms}>
            <Checkbox
              id={termsId}
              name="acceptTerms"
              checked={values.acceptTerms}
              onChange={(event) => update('acceptTerms', event.target.checked)}
              aria-label="I agree to the Terms and Conditions"
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? `${termsId}-error` : undefined}
            />
            <p className={styles.termsText}>
              <label htmlFor={termsId}>I agree to the </label>
              <TextLink as={Link} to="/terms" size="sm" underline>
                Terms and Conditions
              </TextLink>
            </p>
          </div>
          {errors.acceptTerms && (
            <p id={`${termsId}-error`} role="alert" className={styles.termsError}>
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <FormError>{formError}</FormError>
        <PrimaryButton type="submit" size="md" fullWidth disabled={submitting}>
          Sign Up
        </PrimaryButton>
        <SwitchFlow prompt="Already have an account?" to="/login">
          Log in
        </SwitchFlow>
      </AuthCard>
    </AuthPage>
  );
}
