export type InterviewQuestion = {
    question: string,
    answer: string
  };

export type MenuItem = {
    name: string,
    url: string,
    questions?: InterviewQuestion[]
  };

export type Menu = {
    name: string, 
    iconClass: string, 
    active: boolean,
    submenu: MenuItem[]
  }