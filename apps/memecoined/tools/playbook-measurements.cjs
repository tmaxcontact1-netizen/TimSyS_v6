// Outcome-blind measurement functions. No execution, fill, position or P&L imports.
const DAY=86400000,MIN=60000;
function quantile(values,p){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),h=(a.length-1)*p,i=Math.floor(h);return a[i]+(a[Math.ceil(h)]-a[i])*(h-i);}
function arrivalQuantile(values,p){if(!values.length)return null;const a=values.map(x=>x===null?Infinity:x).sort((x,y)=>x-y),v=a[Math.ceil(p*a.length)-1];return Number.isFinite(v)?v:'>20';}
function pivotAt(rows,i){if(i<2||i+2>=rows.length)return [];for(let j=i-2;j<i+2;j++)if(rows[j+1][0]-rows[j][0]!==rows[i][10])return [];
 const others=[rows[i-2],rows[i-1],rows[i+1],rows[i+2]],s=[];
 if(others.every(x=>Number(rows[i][3])>Number(x[3])))s.push('high');
 if(others.every(x=>Number(rows[i][4])<Number(x[4])))s.push('low');return s;
}
function rangeBps(rows){if(!rows.length)return null;let h=-Infinity,l=Infinity;for(const r of rows){h=Math.max(h,Number(r[3]));l=Math.min(l,Number(r[4]));}return (h-l)/l*10000;}
function arrival(rows,reclaim){if(reclaim+20>=rows.length)return {excluded:'boundary'};for(let k=1;k<=20;k++)if(rows[reclaim+k][0]-rows[reclaim+k-1][0]!==MIN)return {excluded:'gap'};for(let k=1;k<=20;k++)if(Number(rows[reclaim+k][5])>Number(rows[reclaim+k][2]))return {bars:k};return {bars:null};}
function ratio(values){const lo=Math.min(...values),hi=Math.max(...values);return lo===0?(hi===0?null:'infinity'):hi/lo;}
module.exports={DAY,MIN,quantile,arrivalQuantile,pivotAt,rangeBps,arrival,ratio};
