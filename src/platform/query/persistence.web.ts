import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  createQueryPersistence,
  shouldPersistQuery,
} from './persistence.shared'

export const {
  clearQueryCache,
  queryPersister,
  queryPersistOptions,
} = createQueryPersistence(AsyncStorage)

export { shouldPersistQuery }
