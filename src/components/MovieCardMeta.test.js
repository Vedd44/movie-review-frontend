import {render,screen} from '@testing-library/react';
import MovieCardMeta from './MovieCardMeta';
test('uses the detail API rating as well as the feed rating without inventing missing facts',()=>{
  const {rerender}=render(<MovieCardMeta movie={{release_date:'2014-11-05',rating:8.5,runtime:169}}/>);
  expect(screen.getByText('2014')).toBeInTheDocument();expect(screen.getByLabelText('TMDB audience rating 8.5 out of 10')).toBeInTheDocument();
  expect(screen.getByText('169 min')).toBeInTheDocument();
  rerender(<MovieCardMeta movie={{vote_average:0}}/>);expect(screen.queryByText(/TMDB/)).not.toBeInTheDocument();
});
