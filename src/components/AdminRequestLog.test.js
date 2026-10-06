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
