export interface ReviewBoundary {start:number;end:number;confirmed:boolean;institution:{state:string;name:string;note?:string};include:string[];notes?:string}
export function reconcileReviewBreaks(value:ReviewBoundary[]|undefined,preview:{candidates:{start:number;end:number}[];blocks:{index:number;component:string}[]}):ReviewBoundary[];
export function nextUnchecked(records:{confirmed:boolean}[],after?:number):number;
