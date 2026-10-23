import { ApiError } from '../../lib/api.js';

const NETWORK_MESSAGE = 'We couldn’t reach PlayLoop. Check your connection and try again.';

// Message for a failure that belongs to the whole form. The API's `message` is written to be shown
// to the user (docs/api: Error.message), so it is used as is.
export function formMessage(error) {
  return error instanceof ApiError ? error.message : NETWORK_MESSAGE;
}

export function isApiError(error, status) {
  return error instanceof ApiError && error.status === status;
}

const USERNAME_UNAVAILABLE = {
  taken: 'That username is already taken.',
  invalid: 'That username isn’t valid.',
  reserved: 'That username is reserved.',
};

export function usernameUnavailableMessage(reason) {
  return USERNAME_UNAVAILABLE[reason] ?? 'That username isn’t available.';
}

// Moves keyboard focus to the first field that has a problem, in form order.
export function focusFirstInvalid(form, fieldOrder, errors) {
  const name = fieldOrder.find((field) => errors[field]);
  form?.elements.namedItem(name)?.focus();
}
