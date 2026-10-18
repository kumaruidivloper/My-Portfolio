import { InterviewQuestion, Menu } from '../types';
import { interviewQuestions } from './interview-questions';
import { moreInterviewQuestions } from './interview-questions-more';

function questionsFor(key: string): InterviewQuestion[] {
  return [...(interviewQuestions[key] ?? []), ...(moreInterviewQuestions[key] ?? [])];
}

function topic(name: string, key: string) {
  return { name, url: '#', questions: questionsFor(key) };
}

export function createInterviewMenus(): Menu[] {
  return [
    {
      name: 'Front-end',
      iconClass: 'fa fa-code',
      active: true,
      submenu: [
        topic('HTML', 'html'),
        topic('CSS', 'css'),
        topic('Javascript', 'javascript'),
        topic('TypeScript', 'typescript'),
        topic('Angular', 'angular'),
        topic('RxJS', 'rxjs'),
        topic('SCSS', 'scss')
      ]
    },
    {
      name: 'Frameworks',
      iconClass: 'fa fa-cubes',
      active: false,
      submenu: [
        topic('React', 'react'),
        topic('Vue', 'vue')
      ]
    },
    {
      name: 'Coding practice',
      iconClass: 'fa fa-terminal',
      active: false,
      submenu: [
        topic('Output based', 'output'),
        topic('DSA', 'dsa'),
        topic('Machine coding', 'machineCoding')
      ]
    },
    {
      name: 'Responsive web',
      iconClass: 'fa fa-mobile',
      active: false,
      submenu: [
        topic('Tablets', 'tablets'),
        topic('Mobiles', 'mobiles'),
        topic('Desktop', 'desktop')
      ]
    },
    {
      name: 'Web Browser',
      iconClass: 'fa fa-globe',
      active: false,
      submenu: [
        topic('Chrome', 'chrome'),
        topic('Firefox', 'firefox'),
        topic('Safari', 'safari'),
        topic('Edge', 'edge')
      ]
    }
  ];
}
