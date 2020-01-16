import Box from '@material-ui/core/Box';
import { navigate } from 'gatsby';
import React from 'react';
import { SearchContainerFilter } from '~/components';
import { Omit } from '~/types';
import { CFSearch, CFSearchProps, CFSearchRenderPropArgs } from './CFSearch';
import { FilteredView } from './FilteredView';
import { ObjectWithEmptyStringDefault } from './ObjectWithEmptyStringDefault';

const itemsFilteredDisplayLimitDefault = 24;
const itemsFilteredDisplayLimitIncrement = 24;

export const {
  Consumer: ContentFinderConsumer,
  Provider: ContentFinderProvider,
} = React.createContext<StateAndHelpers | undefined>(undefined);

interface StateAndHelpers {
  state: State;
}

interface FilterNamesByDropdown {
  [key: string]: string;
}

interface Props<I> {
  searchProps: Omit<CFSearchProps<I>, 'children' | 'items'>;
  items: I[];
  pathname: string;
  baseUrl: string;
  renderFilteredViewCard(i: I): JSX.Element;
  buildPageHeadingFromFilters(f: FilterNamesByDropdown): string;
  buildMetaDescriptionFromFilters(f: FilterNamesByDropdown): string;
  children(s: CFSearchRenderPropArgs<I>): React.ReactNode;
}
export type ContentFinderProps<I> = Props<I>;

interface State {
  pageHeading?: string;
  itemsFilteredLimit: number;
  hasActiveFilters: boolean;
}

export class ContentFinder<I> extends React.Component<Props<I>, State> {
  static Consumer = ContentFinderConsumer;

  static getUrlFilterSegment = ({ baseUrl, pathname }: { baseUrl: string; pathname: string }) => {
    try {
      return pathname.replace(new RegExp(baseUrl), '');
    } catch (e) {
      return '';
    }
  };

  state = {
    pageHeading: '',
    itemsFilteredLimit: itemsFilteredDisplayLimitDefault,
    hasActiveFilters: false,
  };

  makeUrlFilterSegmentFromFilters(filters: SearchContainerFilter<I>[]) {
    if (!filters.length) return '';
    const result = filters.map(filter => filter.urlTitle).join('/');
    return `/${result}`;
  }

  onSearchContainerUpdate: CFSearchProps<I>['onComponentUpdate'] = ({
    state: { prev: prevState, current: curState },
    props: { prev: prevProps, current: curProps },
    stateAndHelpers,
  }) => {
    const { query, filters } = curState;
    const { itemsFilteredLimit, hasActiveFilters } = this.state;

    const newPathname = (prevProps && prevProps.pathname) !== curProps.pathname;
    const newFilters = (prevState && prevState.filters) !== curState.filters;

    // If new path, upate filters. If new filters, navigate to new path
    if (newPathname) {
      const filterSegment = ContentFinder.getUrlFilterSegment({
        baseUrl: this.props.baseUrl,
        pathname: this.props.pathname,
      });
      const filterUrlTitles = filterSegment.split('/').filter(str => str);
      filterUrlTitles.forEach(urlTitle => stateAndHelpers.addFilter({ urlTitle }));
    } else if (newFilters) {
      const newUrl = this.makeUrlFilterSegmentFromFilters(curState.filters);
      const oldUrl = prevState && this.makeUrlFilterSegmentFromFilters(prevState.filters);
      if (newUrl !== oldUrl && newUrl !== this.props.pathname) {
        navigate(`${this.props.baseUrl}${newUrl}`);
      }
    }

    // Prevent infinite update loop
    const newQuery = (prevState && prevState.query) !== curState.query;
    const newHasActiveFilters = filters.length > 0 || query !== '';
    const shouldUpdateState =
      newFilters || newQuery || newPathname || newHasActiveFilters !== hasActiveFilters;
    if (!shouldUpdateState) return;

    // Rebuild heading and meta description based on filters
    const { buildPageHeadingFromFilters } = this.props;
    const filterNamesByDropdown = new ObjectWithEmptyStringDefault();
    filters.forEach(({ displayName, fromDropdown }) => {
      filterNamesByDropdown[fromDropdown.id] = displayName;
    });
    const pageHeading = buildPageHeadingFromFilters(filterNamesByDropdown);

    this.setState({
      pageHeading,
      hasActiveFilters: newHasActiveFilters,

      // If new query or filters, reset display limit
      // Favoriting triggers newItems, so do not trigger reset then
      itemsFilteredLimit:
        newQuery || newFilters ? itemsFilteredDisplayLimitDefault : itemsFilteredLimit,
    });
    // $('meta[name=description]').attr('content', metaDescription); // @TODO set with Helmet?
    document.title = pageHeading; // @TODO set with Helmet?
  };

  onClickLoadMore = () => {
    const increment = itemsFilteredDisplayLimitIncrement;
    this.setState(state => ({
      itemsFilteredLimit: state.itemsFilteredLimit + increment,
    }));
  };

  getStateAndHelpers() {
    return {
      state: this.state,
    };
  }

  render() {
    const { pageHeading, itemsFilteredLimit } = this.state;
    const { searchProps, items, renderFilteredViewCard } = this.props;

    const { hasActiveFilters } = this.state;
    const { children } = this.props;

    return (
      <ContentFinderProvider value={this.getStateAndHelpers()}>z
        <CFSearch<I>
          {...searchProps}
          dropdowns={searchProps.dropdowns}
          onComponentUpdate={this.onSearchContainerUpdate}
          items={items}
          pageHeading={pageHeading}
        >
          {searchHelpers => (
            <>
              <Box display={hasActiveFilters ? 'block' : 'none'}>
                <FilteredView<I>
                  renderCard={renderFilteredViewCard}
                  itemsLimit={itemsFilteredLimit}
                  items={searchHelpers.filteredItems}
                  onClickLoadMore={this.onClickLoadMore}
                  resetSearch={searchHelpers.resetSearchState}
                />
              </Box>
              <Box position="relative" zIndex={1} display={hasActiveFilters ? 'none' : 'block'}>
                {children(searchHelpers)}
              </Box>
            </>
          )}
        </CFSearch>
      </ContentFinderProvider>
    );
  }
}
