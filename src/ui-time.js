import {calendarPublicationIds} from './macro-calendar.js';

const zone='America/New_York';
const dateOnly=/^\d{4}-\d{2}-\d{2}$/;
const validDate=value=>typeof value==='string'&&Boolean(value)&&Number.isFinite(Date.parse(value));

export function humanDate(value){
 if(!validDate(value))return '';
 const date=new Date(dateOnly.test(value)?`${value}T12:00:00Z`:value);
 return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:dateOnly.test(value)?'UTC':zone}).format(date);
}

export function humanTimestamp(value,{prefix=''}={}){
 if(!validDate(value))return '';
 if(dateOnly.test(value))return prefix+humanDate(value);
 const date=new Date(value);
 const clock=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:zone}).format(date).toLowerCase();
 const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:zone}).format(date);
 return `${prefix}${clock} ET, ${day}`;
}

/** Match the reference period explicitly; missing calendar periods cannot identify a release. */
export function calendarReferenceDate(event={}){
 const supplied=event.period??event.referencePeriod;
 if(/^\d{4}-\d{2}-\d{2}$/.test(supplied??''))return supplied;
 if(/^\d{4}-\d{2}$/.test(supplied??''))return supplied+'-01';
 const label=String(event.periodLabel??'');
 const quarter=/^(?:([1-4])(?:st|nd|rd|th)? Quarter(?: and Year)?|Q([1-4]))\s+(\d{4})$/i.exec(label);
 if(quarter)return `${quarter[3]}-${String((Number(quarter[1]??quarter[2])-1)*3+1).padStart(2,'0')}-01`;
 const month=/^([A-Za-z]+)\s+(\d{4})$/.exec(label);
 if(month){
  const index=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(month[1].slice(0,3).toLowerCase());
  if(index>=0)return `${month[2]}-${String(index+1).padStart(2,'0')}-01`;
 }
 const week=/^Week (?:ended|ending) (.+)$/i.exec(label);
 return week&&validDate(week[1])?new Date(week[1]).toISOString().slice(0,10):null;
}

function matchingEvents(series,observation,events){
 if(!series?.id||!observation?.date)return [];
 return events.filter(event=>calendarPublicationIds(event).includes(series.id)&&calendarReferenceDate(event)===observation.date);
}

export function publicationDate(series,observation,events=[]){
 if(validDate(observation?.publishedAt))return observation.publishedAt;
 const dates=matchingEvents(series,observation,events).map(event=>event.publishedAt??event.publicationDate).filter(validDate);
 return new Set(dates).size===1?dates[0]:null;
}

/** A schedule date is evidence of planned timing, never evidence of actual publication. */
export function scheduledReleaseDate(series,observation,events=[]){
 const dates=matchingEvents(series,observation,events).map(event=>event.date).filter(validDate);
 return new Set(dates).size===1?dates[0]:null;
}
