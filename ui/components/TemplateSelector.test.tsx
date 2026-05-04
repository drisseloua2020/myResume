import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AVAILABLE_TEMPLATES } from '../constants';
import TemplateSelector from './TemplateSelector';

describe('TemplateSelector', () => {
  it('renders every available template and marks the selected template', () => {
    render(<TemplateSelector onSelect={vi.fn()} selectedId="modern_tech" />);

    for (const template of AVAILABLE_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
      expect(screen.getByText(template.description)).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: /selected/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /use template/i })).toHaveLength(AVAILABLE_TEMPLATES.length - 1);
  });

  it('calls onSelect with the clicked template id', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<TemplateSelector onSelect={onSelect} />);

    await user.click(screen.getByText('Classic Professional'));

    expect(onSelect).toHaveBeenCalledWith('classic_pro');
  });
});
