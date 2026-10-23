import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/server.js';
import { LogInPage } from './LogInPage.jsx';
import { SignUpPage } from './SignUpPage.jsx';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Explore Games home</p>} />
        <Route path="/login" element={<LogInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillSignUp(user, { username, email, password, acceptTerms = true }) {
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (acceptTerms)
    await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
}

describe('Sign up', () => {
  it('shows what is wrong with each field and sends nothing', async () => {
    const user = userEvent.setup();
    let requests = 0;
    server.use(
      http.post('*/api/auth/register', () => {
        requests += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderAt('/signup');

    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(screen.getByText('Choose a username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Create a password.')).toBeInTheDocument();
    expect(screen.getByText('Accept the Terms and Conditions to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    expect(requests).toBe(0);
  });

  it('rejects a short password before sending', async () => {
    const user = userEvent.setup();
    renderAt('/signup');

    await fillSignUp(user, { username: 'new_player', email: 'new@example.com', password: 'short' });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
  });

  it('checks the username as you type', async () => {
    const user = userEvent.setup();
    renderAt('/signup');

    await user.type(screen.getByLabelText('Username'), 'enolaholmes');
    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInvalid();

    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'fresh_name');
    expect(await screen.findByText(/Username is available\./)).toBeInTheDocument();
  });

  it('reports a reserved username', async () => {
    const user = userEvent.setup();
    renderAt('/signup');

    await user.type(screen.getByLabelText('Username'), 'admin');

    expect(await screen.findByText('That username is reserved.')).toBeInTheDocument();
  });

  it('creates the account and goes to Explore Games', async () => {
    const user = userEvent.setup();
    let body;
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ username: body.username }, { status: 201 });
      }),
    );
    renderAt('/signup');

    await fillSignUp(user, {
      username: 'new_player',
      email: ' new@example.com ',
      password: 'a-good-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText('Explore Games home')).toBeInTheDocument();
    expect(body).toEqual({
      username: 'new_player',
      email: 'new@example.com',
      password: 'a-good-password',
      acceptTerms: true,
    });
  });

  it('puts a 409 on the email field when the email is already registered', async () => {
    const user = userEvent.setup();
    renderAt('/signup');

    await fillSignUp(user, {
      username: 'new_player',
      email: 'enola@example.com',
      password: 'a-good-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
  });

  it('maps a 400 from the API onto its field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid',
            details: [{ path: '/body/email', message: 'must match format "email"' }],
          },
          { status: 400 },
        ),
      ),
    );
    renderAt('/signup');

    await fillSignUp(user, {
      username: 'new_player',
      email: 'new@example.com',
      password: 'a-good-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByText('Must match format "email"')).toBeInTheDocument();
  });

  it('shows a 429 above the button', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
          { status: 429 },
        ),
      ),
    );
    renderAt('/signup');

    await fillSignUp(user, {
      username: 'new_player',
      email: 'new@example.com',
      password: 'a-good-password',
    });
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, please try again later',
    );
  });

  it('links to Log in', () => {
    renderAt('/signup');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});

describe('Log in', () => {
  async function fillLogIn(user, email, password) {
    if (email) await user.type(screen.getByLabelText('Email'), email);
    if (password) await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Log In' }));
  }

  it('asks for both fields without sending a request', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await fillLogIn(user);

    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('logs in and goes to Explore Games', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await fillLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByText('Explore Games home')).toBeInTheDocument();
  });

  it('does not say whether the email or the password was wrong', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await fillLogIn(user, 'enola@example.com', 'not-the-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(screen.queryByText('Explore Games home')).not.toBeInTheDocument();
  });

  it('shows the reason for a suspended account', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    await fillLogIn(user, 'suspended@example.com', 'suspended-pass1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your account is suspended: Repeated spam reports',
    );
  });

  it('rate limits repeated failures', async () => {
    const user = userEvent.setup();
    renderAt('/login');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await user.clear(screen.getByLabelText('Password'));
      await fillLogIn(user, attempt === 0 ? 'enola@example.com' : null, 'wrong-password');
    }
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'storm-chaser-42');
    await user.click(screen.getByRole('button', { name: 'Log In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, please try again later',
    );
  });

  it('says so when the API cannot be reached', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderAt('/login');

    await fillLogIn(user, 'enola@example.com', 'storm-chaser-42');

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t reach PlayLoop');
  });

  it('links to Sign up and Forgot password', () => {
    renderAt('/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
