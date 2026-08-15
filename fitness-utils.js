window.FitnessUtil={
  today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)},
  parse(s){return new Date(s+"T00:00:00")},
  iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)},
  addDays(s,n){const d=this.parse(s);d.setDate(d.getDate()+n);return this.iso(d)},
  startWeek(s){const d=this.parse(s),dow=d.getDay();d.setDate(d.getDate()-(dow===0?0:dow));return this.iso(d)},
  startMonth(s){const d=this.parse(s);d.setDate(1);return this.iso(d)},
  endMonth(s){const d=this.parse(s);d.setMonth(d.getMonth()+1);d.setDate(0);return this.iso(d)},
  datesBetween(a,b){const out=[];for(let d=a;d<=b;d=this.addDays(d,1))out.push(d);return out},
  fmt(s,opt={month:"short",day:"2-digit"}){return this.parse(s).toLocaleDateString(undefined,opt)}
};