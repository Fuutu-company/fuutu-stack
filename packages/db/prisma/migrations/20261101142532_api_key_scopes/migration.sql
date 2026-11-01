-- ApiKey.scopes — registered scope vocabulary the key is restricted to
-- (enforced by requireApiKey in @fuutu/api). Empty array = unrestricted
-- full credential for its owner scope.

-- AlterTable
ALTER TABLE "app"."api_key" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT '{}';
