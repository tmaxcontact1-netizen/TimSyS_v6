import React,{useMemo,useState} from 'react';
import {LazyDetails} from './shared.jsx';
import {schoolRatingsHtml} from './school-ratings-report.js';
import {principalRatingsHtml,reviewRatingsHtml} from './principal-ratings-report.js';

export function RatingsSummary({report,kind}){
 const [index,setIndex]=useState(0),safe=Math.min(index,Math.max(0,report.reviews.length-1)),review=report.reviews[safe];
 const html=useMemo(()=>kind==='school'?schoolRatingsHtml(report,{includeReviews:false}):principalRatingsHtml(report,{includeReviews:false}),[report,kind]);
 return <section><div dangerouslySetInnerHTML={{__html:html}}/><LazyDetails title={`Inspect ratings by review (${report.reviews.length})`}>{()=> <>
 <label>Review<select aria-label="Ratings review" value={safe} onChange={e=>setIndex(Number(e.target.value))}>{report.reviews.map((r,i)=><option key={r.reviewId} value={i}>{i+1} · {r.reviewIdentifier??r.originalReviewNumber??r.reviewId}</option>)}</select></label>
 <div className="wb-pagination"><button disabled={safe===0} onClick={()=>setIndex(safe-1)}>Previous review</button><span>{safe+1} of {report.reviews.length}</span><button disabled={safe+1>=report.reviews.length} onClick={()=>setIndex(safe+1)}>Next review</button></div>
 {review&&<div dangerouslySetInnerHTML={{__html:kind==='school'?schoolRatingsHtml({...report,prompts:[],reviews:[review]}):reviewRatingsHtml(review)}}/>}
 </>}</LazyDetails></section>;
}
