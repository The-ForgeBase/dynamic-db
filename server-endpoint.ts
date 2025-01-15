// // server.ts
// app.get(
//   "/records/:tableName",
//   asyncHandler(async (c: any) => {
//     const tableName = c.req.param("tableName");
//     const queryParams = c.req.query();

//     // Parse complex query parameters
//     const params: QueryParams = {
//       filter: queryParams.filter ? JSON.parse(queryParams.filter) : {},
//       limit: parseInt(queryParams.limit, 10) || 10,
//       offset: parseInt(queryParams.offset, 10) || 0,
//     };

//     // Parse additional query parameters if they exist
//     [
//       "whereRaw",
//       "whereBetween",
//       "whereNull",
//       "whereNotNull",
//       "whereIn",
//       "whereNotIn",
//       "whereExists",
//       "whereGroups",
//       "orderBy",
//       "groupBy",
//       "having",
//       "windowFunctions",
//     ].forEach((param) => {
//       if (queryParams[param]) {
//         params[param] = JSON.parse(queryParams[param]);
//       }
//     });

//     // Validate table name
//     const validTables = ["users", "products", "orders"];
//     if (!validTables.includes(tableName)) {
//       return c.json({ error: "Invalid table name" }, 400);
//     }

//     // Build and execute query
//     const queryHandler = new QueryHandler(hookableDB);
//     const query = queryHandler.buildQuery(tableName, params);

//     const records = await hookableDB.query(tableName, () => query, params);

//     const filteredRows = await enforcePermissions(
//       tableName,
//       "SELECT",
//       records,
//       user
//     );

//     return c.json({ records: filteredRows });
//   })
// );

// // Example middleware for query validation
// const validateQuery = (params: QueryParams) => {
//   const maxLimit = 1000;
//   const errors: string[] = [];

//   if (params.limit && params.limit > maxLimit) {
//     errors.push(`Limit exceeds maximum allowed value of ${maxLimit}`);
//   }

//   // Add more validation rules as needed

//   return errors;
// };

// // Example middleware for query optimization
// const optimizeQuery = (params: QueryParams) => {
//   const suggestions: string[] = [];

//   // Check for missing indexes on frequently filtered fields
//   if (params.whereRaw?.length > 2 && !params.orderBy) {
//     suggestions.push("Consider adding indexes for filtered fields");
//   }

//   // Add more optimization suggestions as needed

//   return suggestions;
// };
