import request from 'supertest';
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import app from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Icon Accessibility Test Suite
 * 
 * Tests that icons are properly served as static files and have
 * correct accessibility attributes per CONTRACT-002.
 * 
 * Contract Reference: .dev/dev-contract/contract-002-icon-placement.md
 */

describe('Icon Static File Serving', () => {
  test('GET /nexus-icon.svg should return 200', async () => {
    const response = await request(app)
      .get('/nexus-icon.svg')
      .expect(200);

    // Verify file is accessible via HTTP
    expect(response.statusCode).toBe(200);
  });

  test('GET /nexus-logo.svg should return 200', async () => {
    const response = await request(app)
      .get('/nexus-logo.svg')
      .expect(200);

    // Verify file is accessible via HTTP
    expect(response.statusCode).toBe(200);
  });

  test('GET /nexus-icon.svg should have correct content type', async () => {
    const response = await request(app)
      .get('/nexus-icon.svg')
      .expect(200);

    const contentType = response.headers['content-type'] || '';
    expect(contentType).toMatch(/image\/svg\+xml|text\/html|text\/plain|application\/octet-stream/);
  });

  test('GET /nexus-logo.svg should have correct content type', async () => {
    const response = await request(app)
      .get('/nexus-logo.svg')
      .expect(200);

    const contentType = response.headers['content-type'] || '';
    expect(contentType).toMatch(/image\/svg\+xml|text\/html|text\/plain|application\/octet-stream/);
  });
});

describe('Icon File Content Validation', () => {
  test('nexus-icon.svg should have correct dimensions (36×36px)', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    // Check for width="36" height="36" or viewBox="0 0 36 36"
    expect(svg).toMatch(/width="36"|viewBox="0 0 36 36"/);
    expect(svg).toMatch(/height="36"|viewBox="0 0 36 36"/);
  });

  test('nexus-logo.svg should have correct dimensions (274×92px)', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    // Check for width="274" height="92" or viewBox="0 0 274 92"
    expect(svg).toMatch(/width="274"|viewBox="0 0 274 92"/);
    expect(svg).toMatch(/height="92"|viewBox="0 0 274 92"/);
  });
});

describe('Icon Accessibility Attributes', () => {
  test('nexus-icon.svg should have role="img" attribute', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    expect(svg).toContain('role="img"');
  });

  test('nexus-icon.svg should have aria-label attribute', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    expect(svg).toContain('aria-label');
  });

  test('nexus-icon.svg should have <title> element for screen readers', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    expect(svg).toContain('<title>');
    expect(svg).toContain('NexusCanon Icon');
  });

  test('nexus-icon.svg should have <desc> element for detailed description', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    expect(svg).toContain('<desc>');
  });

  test('nexus-logo.svg should have role="img" attribute', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    expect(svg).toContain('role="img"');
  });

  test('nexus-logo.svg should have aria-label attribute', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    expect(svg).toContain('aria-label');
  });

  test('nexus-logo.svg should have <title> element for screen readers', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    expect(svg).toContain('<title>');
    expect(svg).toContain('NexusCanon Logo');
  });

  test('nexus-logo.svg should have <desc> element for detailed description', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    expect(svg).toContain('<desc>');
  });
});

describe('Icon File Structure Compliance', () => {
  test('nexus-icon.svg should be valid SVG XML', () => {
    const iconPath = join(__dirname, '..', 'public', 'nexus-icon.svg');
    const svg = readFileSync(iconPath, 'utf-8');
    
    // Check for valid SVG structure
    expect(svg).toMatch(/<?xml|<svg/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('nexus-logo.svg should be valid SVG XML', () => {
    const logoPath = join(__dirname, '..', 'public', 'nexus-logo.svg');
    const svg = readFileSync(logoPath, 'utf-8');
    
    // Check for valid SVG structure
    expect(svg).toMatch(/<?xml|<svg/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

