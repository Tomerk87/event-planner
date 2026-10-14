import { Global, Module } from '@nestjs/common'
import { FilesController } from './files.controller.ts'
import { ImageStorage } from './image-storage.ts'

@Global()
@Module({
  controllers: [FilesController],
  providers: [ImageStorage],
  exports: [ImageStorage],
})
export class StorageModule {}
