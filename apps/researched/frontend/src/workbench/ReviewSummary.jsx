import {reviewRatingsHtml} from './principal-ratings-report.js';
import {LazyDetails,Pager} from './shared.jsx';
import React,{useState,useMemo} from 'react';
export default function ReviewSummary({value:a,ratings}){
 const [selected,setSelected]=useState('');const c=a.competencies.find(c=>c.competencyId===selected)??a.competencies[0];
 const byReview=useMemo(()=>new Map((ratings?.reviews??[]).map(r=>[r.reviewId,r])),[ratings]);
 return <section aria-label="Review-level analysis"><h3>Review-level analysis</h3><p>{a.notice}</p><p>Eligible distinct reviews: {a.eligibleReviews}</p><p>Review prevalence = reviews represented ÷ {a.eligibleReviews} × 100</p><p>Evidence locations show volume; prevalence shows breadth; density shows concentration. No weighting or composite score.</p>
 <table><thead><tr><th>Competency</th><th>Reviews represented</th><th>Review prevalence %</th><th>Explicit reviews</th><th>Contextual-only reviews</th><th>Evidence density</th></tr></thead><tbody>{a.competencies.map(c=><tr key={c.competencyId}><td>{c.competency}</td>{['reviewsRepresented','reviewPrevalence','explicitReviews','contextualOnlyReviews','evidenceDensity'].map(k=><td key={k}>{c[k]===null?'N/A':(['evidenceDensity','reviewPrevalence'].includes(k)?c[k].toFixed(2):c[k])}</td>)}</tr>)}</tbody></table>
 <LazyDetails title="Valence and review evidence trail">{()=> <><p>Valence counts are evidence locations, not review-level votes. Full downloads include every review and evidence location.</p>
 <label>Competency<select aria-label="Evidence trail competency" value={c?.competencyId??''} onChange={e=>setSelected(e.target.value)}>{a.competencies.map(c=><option key={c.competencyId} value={c.competencyId}>{c.competency}</option>)}</select></label>
 {c&&<section><h4>{c.competency}</h4><p>{Object.entries(c.valence).map(([k,v])=>k+': '+v).join(' · ')}</p><p>{c.reviewIds.length} represented reviews · {c.evidence.length} evidence locations</p>
 <Pager key={c.competencyId+'-evidence'} items={c.evidence} render={items=>items.map((e,i)=><p key={i}>Review {e.reviewId} · Unit {e.unitId} · {e.route} · {e.valence??'unassigned'}</p>)}/>
 <LazyDetails key={c.competencyId} title="Represented review IDs and ratings">{()=> <Pager items={c.reviewIds} render={ids=>ids.map(id=><section key={id}><p>Review {id}</p>{ratings&&<LazyDetails title="Respondent ratings">{()=> <div dangerouslySetInnerHTML={{__html:reviewRatingsHtml(byReview.get(id))}}/>}</LazyDetails>}</section>)}/>}</LazyDetails></section>}
 <LazyDetails title="Denominator review IDs">{()=> <Pager items={a.eligibleReviewIds} render={ids=>ids.map(id=><p key={id}>{id}</p>)}/>}</LazyDetails><p>Reporting specification: {a.version}</p></>}</LazyDetails></section>;
}
