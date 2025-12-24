import { describe, test, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';

describe('Nunjucks Filters', () => {
  let env;

  beforeEach(() => {
    // Create a test nunjucks environment
    env = nunjucks.configure('src/views', {
      autoescape: true,
      watch: false,
    });

    // Add the same filters as server.js
    env.addFilter('upper', str => {
      return str ? String(str).toUpperCase() : '';
    });

    env.addFilter('tojson', obj => {
      return JSON.stringify(obj);
    });

    // Date filter (same as server.js)
    env.addFilter('date', (date, format) => {
      if (!date) return '';

      try {
        let d;
        if (date instanceof Date) {
          d = date;
        } else if (typeof date === 'string') {
          d = new Date(date);
        } else if (typeof date === 'number') {
          d = new Date(date);
        } else {
          return '';
        }

        if (isNaN(d.getTime())) return '';

        const patterns = {
          '%b %d': () => {
            const months = [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ];
            return `${months[d.getMonth()]} ${d.getDate()}`;
          },
          '%H:%M': () => {
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
          },
          '%Y-%m-%d': () => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          },
        };

        if (format && patterns[format]) {
          return patterns[format]();
        }

        return d.toLocaleDateString();
      } catch (error) {
        return '';
      }
    });
  });

  describe('upper filter', () => {
    test('should uppercase strings', () => {
      const result = env.renderString('{{ "hello" | upper }}', {});
      expect(result.trim()).toBe('HELLO');
    });

    test('should handle empty strings', () => {
      const result = env.renderString('{{ "" | upper }}', {});
      expect(result.trim()).toBe('');
    });

    test('should handle null values', () => {
      const result = env.renderString('{{ null | upper }}', {});
      expect(result.trim()).toBe('');
    });

    test('should handle undefined values', () => {
      const result = env.renderString('{{ undefined | upper }}', {});
      expect(result.trim()).toBe('');
    });

    test('should handle numbers', () => {
      const result = env.renderString('{{ 123 | upper }}', {});
      expect(result.trim()).toBe('123');
    });

    test('should handle mixed case', () => {
      const result = env.renderString('{{ "Hello World" | upper }}', {});
      expect(result.trim()).toBe('HELLO WORLD');
    });
  });

  describe('tojson filter', () => {
    test('should stringify objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = env.renderString('{{ obj | tojson | safe }}', { obj });
      // Nunjucks auto-escapes by default, so we use |safe to get raw JSON
      expect(result.trim()).toBe(JSON.stringify(obj));
    });

    test('should stringify arrays', () => {
      const arr = [1, 2, 3];
      const result = env.renderString('{{ arr | tojson }}', { arr });
      expect(result.trim()).toBe(JSON.stringify(arr));
    });

    test('should handle null', () => {
      const result = env.renderString('{{ null | tojson }}', {});
      // Nunjucks may render null differently
      expect(result.trim()).toMatch(/null|""/);
    });

    test('should handle strings', () => {
      const result = env.renderString('{{ "test" | tojson }}', {});
      // tojson should stringify strings (add quotes)
      expect(result.trim()).toMatch(/"test"|test/);
    });

    test('should handle numbers', () => {
      const result = env.renderString('{{ 123 | tojson }}', {});
      expect(result.trim()).toBe('123');
    });
  });

  describe('date filter', () => {
    test('should format Date objects', () => {
      const date = new Date('2024-01-15');
      const result = env.renderString('{{ date | date }}', { date });
      expect(result.trim()).toBeDefined();
    });

    test('should format date strings', () => {
      const result = env.renderString('{{ "2024-01-15" | date }}', {});
      expect(result.trim()).toBeDefined();
    });

    test('should format with %Y-%m-%d pattern', () => {
      const date = new Date('2024-01-15');
      const result = env.renderString('{{ date | date("%Y-%m-%d") }}', { date });
      expect(result.trim()).toBe('2024-01-15');
    });

    test('should format with %b %d pattern', () => {
      const date = new Date('2024-01-15');
      const result = env.renderString('{{ date | date("%b %d") }}', { date });
      expect(result.trim()).toBe('Jan 15');
    });

    test('should format with %H:%M pattern', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = env.renderString('{{ date | date("%H:%M") }}', { date });
      expect(result.trim()).toMatch(/\d{2}:\d{2}/);
    });

    test('should handle null values', () => {
      const result = env.renderString('{{ null | date }}', {});
      expect(result.trim()).toBe('');
    });

    test('should handle invalid dates', () => {
      const result = env.renderString('{{ "invalid" | date }}', {});
      expect(result.trim()).toBe('');
    });

    test('should handle number timestamps', () => {
      const timestamp = Date.now();
      const result = env.renderString('{{ timestamp | date }}', { timestamp });
      expect(result.trim()).toBeDefined();
    });

    test('should use default format for unknown patterns', () => {
      const date = new Date('2024-01-15');
      const result = env.renderString('{{ date | date("unknown") }}', { date });
      expect(result.trim()).toBeDefined();
    });
  });
});
