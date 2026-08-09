import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVAILABLE_TEMPLATES } from '../constants';
import { SubscriptionPlan, UserRole, type User, type UserInputData } from '../types';
import LivePreview from './LivePreview';

const previewUser: User = {
  id: 'usr_preview',
  name: 'Jordan Preview',
  email: 'jordan@example.com',
  role: UserRole.USER,
  plan: SubscriptionPlan.FREE,
  status: 'Active',
  createdAt: '2026-05-01T00:00:00Z',
  paidAmount: '$0.00',
};

const previewData: UserInputData = {
  role: UserRole.USER,
  plan: SubscriptionPlan.FREE,
  targetRole: 'Product Manager',
  personalDetails: {
    firstName: 'Jordan',
    lastName: 'Preview',
    email: 'jordan@example.com',
    phone: '555-0100',
    address: '',
    city: 'Austin',
    state: 'TX',
    country: 'United States',
    postalCode: '78701',
    summary: 'Product leader focused on measurable customer outcomes.',
  },
  experienceItems: [{
    id: 'exp_1',
    role: 'Product Manager',
    company: 'Acme Products',
    dates: '2021 - Present',
    description: 'Led product launches\nImproved activation by 18%',
  }],
  educationItems: [{
    id: 'edu_1',
    school: 'State University',
    degree: 'BS Business',
    dates: '2015 - 2019',
  }],
  skillItems: [{
    id: 'skill_1',
    category: 'Core',
    items: 'Roadmaps, Analytics, Stakeholder Management',
  }],
  preferences: {
    pages: '1-page',
    tone: 'modern',
    region: 'US',
    photo: false,
  },
};

const bespokeTemplateIds = new Set([
  'classic_pro',
  'modern_tech',
  'creative_bold',
  'executive_lead',
  'minimalist_clean',
  'compact_grid',
]);

const categoryTemplates = AVAILABLE_TEMPLATES.filter((template) => !bespokeTemplateIds.has(template.id));

describe('LivePreview category templates', () => {
  it.each(categoryTemplates.map((template) => [template.id, template.name]))(
    'renders a dedicated live resume layout for %s',
    (templateId, _templateName) => {
      render(<LivePreview data={previewData} user={previewUser} templateId={templateId} />);

      expect(screen.getByTestId(`live-preview-${templateId}`)).toBeInTheDocument();
      expect(screen.getByText('Jordan Preview')).toBeInTheDocument();
      expect(screen.getAllByText('Product Manager').length).toBeGreaterThan(0);
    },
  );
});
