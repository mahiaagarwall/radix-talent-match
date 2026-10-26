import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders, AppRoutes } from '../src/App';

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}
