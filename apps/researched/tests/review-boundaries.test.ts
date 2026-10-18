import {it,expect} from 'vitest';
import {confirmedReview} from '../src/domain/mcf-evidence.js';
import {semanticFailureCategory} from '../src/domain/semantic-failure.js';
it('a checkbox cannot turn a compiled document into one review',()=>{expect(confirmedReview({original_text:'Characteristics:\nFirst\nCharacteristics:\nSecond',locator:{recordMode:'document'}},{reviewBoundariesConfirmed:true})).toBe(false);expect(confirmedReview({original_text:'One legitimate review.'},{reviewBoundariesConfirmed:true})).toBe(true);});
it.each([['ai_provider_http_502','provider'],['ai_provider_http_429','provider'],['ai_provider_http_401','connection'],['ai_provider_http_403','connection'],['fetch failed','provider'],['unsupported_mcf_citation','response']])('categorises %s', (message,category)=>expect(semanticFailureCategory(Error(message))).toBe(category));
