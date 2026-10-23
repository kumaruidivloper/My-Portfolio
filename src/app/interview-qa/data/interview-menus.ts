import { InterviewQuestion, Menu } from '../types';

type QuestionBank = Record<string, InterviewQuestion[]>;

/** The question text lives in separate lazy chunks, so the dialog shell renders before it downloads. */
export async function loadInterviewMenus(): Promise<Menu[]> {
  const [{ interviewQuestions }, { moreInterviewQuestions }] = await Promise.all([
    import('./interview-questions'),
    import('./interview-questions-more')
  ]);
  return createInterviewMenus(interviewQuestions, moreInterviewQuestions);
}

export function createInterviewMenus(...banks: QuestionBank[]): Menu[] {
  const topic = (name: string, key: string) => ({
    name,
    url: '#',
    questions: banks.flatMap(bank => bank[key] ?? [])
  });

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
