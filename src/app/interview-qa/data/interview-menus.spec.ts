/// <reference types="jasmine" />

import { createInterviewMenus } from './interview-menus';

describe('createInterviewMenus', () => {
  const menus = createInterviewMenus();
  const topics = menus.flatMap(menu => menu.submenu);

  it('gives every topic several interview questions', () => {
    topics.forEach(topic => {
      expect(topic.questions?.length).withContext(topic.name).toBeGreaterThanOrEqual(6);
    });
  });

  it('keeps inline code markers balanced', () => {
    topics.flatMap(topic => topic.questions ?? []).forEach(({ question, answer }) => {
      expect(question.split('`').length % 2).withContext(question).toBe(1);
      expect(answer.split('`').length % 2).withContext(question).toBe(1);
    });
  });

  it('has no duplicate questions within a topic', () => {
    topics.forEach(topic => {
      const questions = (topic.questions ?? []).map(qa => qa.question);
      expect(new Set(questions).size).withContext(topic.name).toBe(questions.length);
    });
  });

  it('opens only the first menu by default', () => {
    expect(menus.filter(menu => menu.active).length).toBe(1);
    expect(menus[0].active).toBeTrue();
  });
});
