import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import AdminRequestLog from './AdminRequestLog';
test('filters requests by acquisition source and guest status while showing the actual prompt/result',()=>{
 render(<AdminRequestLog rows={[
 {id:'1',session:'abc',time:'2026-10-06T14:00:00Z',prompt:'A clever thriller',movie_title:'The Prestige',authenticated:false,acquisition:{channel:'paid',source:'instagram'}},
 {id:'2',session:'def',time:'2026-10-06T14:00:00Z',prompt:'Is it scary?',result_text:'It is tense.',kind:'answer',authenticated:true,acquisition:{channel:'organic',source:'google.com'}},
 ]}/>);
 expect(screen.getByText('The Prestige')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Visitors'),{target:{value:'guest'}});
 expect(screen.queryByText('Is it scary?')).toBeNull();
 fireEvent.change(screen.getByLabelText('Source'),{target:{value:'organic'}});
 expect(screen.queryByText('A clever thriller')).toBeNull();
 expect(screen.getByText(/No recorded requests match/)).toBeInTheDocument();
});

test('labels public explanations and distinguishes recorded follow-through from missing activity',()=>{
 render(<AdminRequestLog rows={[{id:'1',time:'2026-10-06T14:00:00Z',result_text:'A waitress faces danger during the overnight diner shift.',follow_through:{result_clicks:2,opened_details:true,continued_browsing:true,destinations:['movie','collection'],clicked_providers:['Tubi TV'],asked_again:true,last_activity_seconds:12,recorded_activity:true}},{id:'2',time:'2026-10-06T15:00:00Z',follow_through:{result_clicks:0,recorded_activity:false}}]}/>);
 expect(screen.getByText('User-facing explanation')).toBeInTheDocument();expect(screen.getByText('2 result link clicks')).toBeInTheDocument();expect(screen.getByText('Opened movie details')).toBeInTheDocument();expect(screen.getByText('Continued browsing: movie, collection')).toBeInTheDocument();expect(screen.getByText('Provider: Tubi TV')).toBeInTheDocument();expect(screen.getByText('Submitted another request')).toBeInTheDocument();expect(screen.getByText('No further activity recorded')).toBeInTheDocument();
});

test('filters the full result set before pagination and includes the whole selected local day',()=>{
 const rows=Array.from({length:125},(_,i)=>({id:String(i),time:'2026-10-08T12:00:00Z',page:i===124?'ask':'home',authenticated:false,prompt:`Request ${i}`}));
 render(<AdminRequestLog rows={rows}/>);expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
 fireEvent.click(screen.getByText('Next requests'));expect(screen.getByText('Request 50')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Experience'),{target:{value:'ask'}});expect(screen.getByText('Request 124')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-10-08'}});fireEvent.change(screen.getByLabelText('Through'),{target:{value:'2026-10-08'}});expect(screen.getByText('Request 124')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('From'),{target:{value:'2026-10-09'}});expect(screen.queryByText('Request 124')).toBeNull();
});
