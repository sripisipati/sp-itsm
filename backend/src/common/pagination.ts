export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export function paginationMeta(page: number, pageSize: number, totalRecords: number): PaginationMeta {
  return {
    page,
    pageSize,
    totalRecords,
    totalPages: totalRecords === 0 ? 0 : Math.ceil(totalRecords / pageSize),
  };
}
